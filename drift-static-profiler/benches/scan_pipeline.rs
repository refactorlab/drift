//! Criterion micro-benchmarks for the static-profiler hot paths.
//!
//! Phase 0 baseline. Two groups, both language-agnostic:
//!
//!   1. `analyze` — runs the public `analyze()` entry point on a
//!      per-language fixture directory under
//!      `tests/fixtures/bench/<slug>/`. The bench iterates
//!      `Language::all()` and asks `profile_for(lang)` for whatever
//!      it needs — no `match lang { … }` in this file. Adding a 9th
//!      language is one new fixture directory and zero edits here.
//!
//!   2. `tags_extract` — measures the parse-only cost (one file at a
//!      time) so a parser regression doesn't hide behind graph cost
//!      and vice versa. Iterates the same fixture set.
//!
//! Why we ride on `analyze()` and not on synthesized strings: the bench
//! must measure what users actually call. A bench against synthetic
//! input is a bench of synthetic input. Real fixtures + real entry
//! point = real signal.

use std::path::PathBuf;

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use drift_static_profiler::api::{analyze, AnalyzeOptions};
use drift_static_profiler::languages::profile_for;
use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::Language;

/// Root directory holding per-language bench fixtures.
/// `tests/fixtures/bench/<slug>/...`.
fn bench_fixtures_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests");
    p.push("fixtures");
    p.push("bench");
    p
}

/// Walk a language's fixture directory and return the first source file
/// of the matching extension. Used by `tags_extract` so each bench
/// targets one canonical file rather than re-walking the directory on
/// every iteration. Returns `None` if the directory is missing or holds
/// no matching file — caller skips the bench in that case.
fn first_fixture_file(lang: Language) -> Option<PathBuf> {
    let dir = bench_fixtures_root().join(lang.slug());
    let entries = std::fs::read_dir(&dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if Language::from_path(&path) == Some(lang) {
            return Some(path);
        }
    }
    None
}

fn bench_analyze(c: &mut Criterion) {
    let opts = AnalyzeOptions {
        // SQL-file scan is irrelevant to the bench and walks the
        // fixture dir twice; disable so the number reflects the
        // call-graph pipeline only.
        scan_sql_files: false,
        ..AnalyzeOptions::default()
    };
    let mut group = c.benchmark_group("analyze");
    for &lang in Language::all() {
        let dir = bench_fixtures_root().join(lang.slug());
        if !dir.exists() {
            eprintln!("warn: missing bench fixture for {lang:?} at {dir:?}");
            continue;
        }
        // Sanity-check: profile_for must match the dir we're benching.
        // If `lang.slug()` ever drifts from `profile_for(lang).language()`
        // we want the bench to fail loudly, not silently mis-measure.
        debug_assert_eq!(profile_for(lang).language(), lang);
        group.bench_with_input(
            BenchmarkId::new("lang", lang.slug()),
            &dir,
            |b, dir| b.iter(|| analyze(black_box(dir), &[], &opts).unwrap()),
        );
    }
    group.finish();
}

fn bench_tags_extract(c: &mut Criterion) {
    let mut group = c.benchmark_group("tags_extract");
    for &lang in Language::all() {
        let Some(path) = first_fixture_file(lang) else {
            eprintln!("warn: no bench source file for {lang:?}");
            continue;
        };
        let source = std::fs::read_to_string(&path).expect("read fixture");
        group.bench_with_input(
            BenchmarkId::new("lang", lang.slug()),
            &(path, source),
            |b, (path, source)| {
                b.iter(|| {
                    extract_tags_from_source(black_box(path), lang, black_box(source)).unwrap()
                })
            },
        );
    }
    group.finish();
}

criterion_group!(benches, bench_analyze, bench_tags_extract);
criterion_main!(benches);
