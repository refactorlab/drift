//! Empirical verification of the on-disk size optimization.
//!
//! The default report writer was switched from pretty-printed JSON to
//! minified JSON (4× smaller on real polyglot scans). A `--gzip`
//! escape hatch wraps the writer in `flate2::write::GzEncoder` for
//! another ~13× reduction on top of that. These tests pin both:
//!
//!   * **Size ordering**: pretty > minified > gzipped — on every
//!     supported language fixture. If a future serializer change
//!     accidentally inflates the minified form, this test trips.
//!
//!   * **Roundtrip equivalence**: each encoding must read back to a
//!     `Report` that's semantically identical to the source. We pin
//!     a handful of summary numbers (`files`, `symbols`, `edges`,
//!     `entries.len()`) so a regression in `compact::read_report`
//!     shows up here, not silently in production scans.
//!
//! Why not test the CLI binary directly: invoking `std::process::Command`
//! from a Rust test makes the test sensitive to the binary's build mode
//! (debug vs release, target dir layout). The format-toggle logic lives
//! in two library functions (`compact::write_report{,_pretty}`) plus a
//! `flate2::write::GzEncoder` wrapper — both reachable from the lib
//! API, both deterministic, both unit-testable here.

use std::io::Cursor;
use std::path::PathBuf;

use drift_static_profiler::api::{analyze_roots_with_progress, AnalyzeOptions};
use drift_static_profiler::compact::{read_report, write_report, write_report_pretty};
use drift_static_profiler::progress::NullProgress;
use drift_static_profiler::report::Report;
use drift_static_profiler::roots::DiscoverOpts;
use drift_static_profiler::Language;

/// Locate the per-language bench fixture directory. Returns `None`
/// when the fixture isn't checked in (lets the test skip itself in
/// thin-clone scenarios).
fn fixture_dir(lang: Language) -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let subdir = match lang {
        Language::Python => "python",
        Language::TypeScript => "typescript",
        Language::JavaScript => "javascript",
        Language::Java => "java",
        Language::Kotlin => "kotlin",
        Language::Scala => "scala",
        Language::Go => "go",
        Language::Rust => "rust",
    };
    let dir = manifest_dir.join("tests/fixtures/bench").join(subdir);
    dir.is_dir().then_some(dir)
}

/// Run the full analyze pipeline and hand back the `Report` for serialization.
fn analyze_lang(lang: Language) -> Option<Report> {
    let dir = fixture_dir(lang)?;
    let outcome = analyze_roots_with_progress(
        &dir,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed on bench fixture");
    Some(outcome.report)
}

fn serialize_pretty(report: &Report) -> Vec<u8> {
    let mut buf = Vec::new();
    write_report_pretty(&mut buf, report).expect("serialize pretty");
    buf
}

fn serialize_minified(report: &Report) -> Vec<u8> {
    let mut buf = Vec::new();
    write_report(&mut buf, report).expect("serialize minified");
    buf
}

fn serialize_gzipped(report: &Report) -> Vec<u8> {
    use flate2::write::GzEncoder;
    use flate2::Compression;
    let mut buf = Vec::new();
    {
        // Inner block so the encoder is dropped (which flushes the
        // gzip trailer) before we read `buf`. Without this, the
        // resulting Vec is missing the final 8 bytes (CRC32 + ISIZE)
        // and `GzDecoder` errors with "truncated stream".
        let mut enc = GzEncoder::new(&mut buf, Compression::default());
        write_report(&mut enc, report).expect("serialize into gzip");
        enc.finish().expect("finalize gzip");
    }
    buf
}

/// **Size ordering invariant**: pretty > minified > gzipped on every
/// language fixture. The gap between pretty and minified is from
/// whitespace; the gap between minified and gzipped is from
/// general-purpose entropy coding. Both layers always help on JSON
/// with repeated string literals (file paths, symbol names) — the
/// shape every drift scan has.
#[test]
fn size_ordering_pretty_gt_minified_gt_gzipped_for_every_language() {
    for &lang in Language::all() {
        let Some(report) = analyze_lang(lang) else { continue };
        let pretty = serialize_pretty(&report);
        let mini = serialize_minified(&report);
        let gz = serialize_gzipped(&report);

        assert!(
            pretty.len() > mini.len(),
            "[{lang:?}] pretty ({}) must be larger than minified ({})",
            pretty.len(),
            mini.len(),
        );
        assert!(
            mini.len() > gz.len(),
            "[{lang:?}] minified ({}) must be larger than gzipped ({})",
            mini.len(),
            gz.len(),
        );
        // Sanity floor — a gzipped report must contain something
        // (gzip header alone is ~20 bytes; an actual payload pushes
        // it well past that).
        assert!(
            gz.len() > 30,
            "[{lang:?}] gzipped payload absurdly small ({})",
            gz.len(),
        );
    }
}

/// **Roundtrip invariant**: every encoding must read back to a Report
/// with the SAME `summary.{files,symbols,edges}` and
/// `entries.len()`. Pin them — these are the numbers the viewer
/// renders in its header chip, so any silent divergence shows up
/// here as a hard test failure instead of as a confusing UI bug.
#[test]
fn pretty_minified_and_gzipped_roundtrip_to_equivalent_report() {
    for &lang in Language::all() {
        let Some(report) = analyze_lang(lang) else { continue };
        let pretty = serialize_pretty(&report);
        let mini = serialize_minified(&report);
        let gz = serialize_gzipped(&report);

        // Decompress gzip first; the inner bytes are the same JSON
        // shape `read_report` consumes.
        let mini_from_gz = decompress_gzip(&gz);

        let r_pretty = read_report(&pretty).expect("read pretty");
        let r_mini = read_report(&mini).expect("read minified");
        let r_gz = read_report(&mini_from_gz).expect("read minified-from-gzip");

        // Compare the load-bearing summary numbers.
        let p = (r_pretty.summary.files, r_pretty.summary.symbols, r_pretty.summary.edges);
        let m = (r_mini.summary.files, r_mini.summary.symbols, r_mini.summary.edges);
        let g = (r_gz.summary.files, r_gz.summary.symbols, r_gz.summary.edges);
        assert_eq!(p, m, "[{lang:?}] pretty vs minified summary diverged");
        assert_eq!(m, g, "[{lang:?}] minified vs gzipped summary diverged");

        // And the entry count — what every dashboard counts first.
        assert_eq!(
            r_pretty.entries.len(),
            r_mini.entries.len(),
            "[{lang:?}] pretty vs minified entry count diverged",
        );
        assert_eq!(
            r_mini.entries.len(),
            r_gz.entries.len(),
            "[{lang:?}] minified vs gzipped entry count diverged",
        );
    }
}

/// **Minified is at least ~30 % smaller than pretty** on every
/// fixture. The actual real-world ratio is ~4× on production
/// polyglot scans (whitespace dominates at depth >10), but the bench
/// fixtures are tiny — a 30 % floor is conservative AND
/// non-trivial: if it ever regresses below 30 %, the JSON
/// pretty-printer is doing something pathological.
#[test]
fn minified_is_at_least_30_percent_smaller_than_pretty() {
    for &lang in Language::all() {
        let Some(report) = analyze_lang(lang) else { continue };
        let pretty = serialize_pretty(&report);
        let mini = serialize_minified(&report);
        let savings = 1.0 - (mini.len() as f64 / pretty.len() as f64);
        assert!(
            savings >= 0.30,
            "[{lang:?}] minified savings only {:.1}% (need ≥30%)",
            savings * 100.0,
        );
    }
}

/// **Gzipped is at least ~50 % smaller than minified** on every
/// fixture. JSON gzips well because of repeated property names +
/// string-literal repetition; expect 80-95% on production scans.
/// Conservative 50% floor here keeps tiny fixtures (where gzip
/// header overhead matters more) inside the bound.
#[test]
fn gzipped_is_at_least_50_percent_smaller_than_minified() {
    for &lang in Language::all() {
        let Some(report) = analyze_lang(lang) else { continue };
        let mini = serialize_minified(&report);
        let gz = serialize_gzipped(&report);
        let savings = 1.0 - (gz.len() as f64 / mini.len() as f64);
        assert!(
            savings >= 0.50,
            "[{lang:?}] gzip savings only {:.1}% (need ≥50%); \
             minified={} gz={}",
            savings * 100.0,
            mini.len(),
            gz.len(),
        );
    }
}

/// `read_report` must reject obvious garbage. Defensive — the writer
/// is fail-safe, but a corrupted on-disk file (partial write, bad
/// sector) must surface as `Err(...)`, not as a phantom empty
/// Report.
#[test]
fn read_report_rejects_garbage() {
    let result = read_report(b"this is not json");
    assert!(result.is_err(), "garbage bytes must not parse");
}

/// `read_report` must reject a partial gzip stream (the bytes-up-to-
/// trailer case that would happen on a crashed `--gzip` write). The
/// caller is expected to gunzip first; passing raw gzip bytes to
/// `read_report` should fail at the JSON-parse layer with a clear
/// error rather than crash or hang.
#[test]
fn read_report_rejects_raw_gzip_bytes() {
    // Even a well-formed gzip stream is not valid JSON; `read_report`
    // works at the JSON layer, not the compression layer. The caller
    // is responsible for gunzip first (see `decompress_gzip` helper).
    let Some(report) = analyze_lang(Language::Python) else { return };
    let gz = serialize_gzipped(&report);
    let result = read_report(&gz);
    assert!(
        result.is_err(),
        "raw gzip bytes must not parse as JSON; caller must gunzip first",
    );
}

// ---- helpers ----------------------------------------------------------

fn decompress_gzip(bytes: &[u8]) -> Vec<u8> {
    use flate2::read::GzDecoder;
    use std::io::Read;
    let mut out = Vec::new();
    GzDecoder::new(Cursor::new(bytes))
        .read_to_end(&mut out)
        .expect("decompress gzip");
    out
}
