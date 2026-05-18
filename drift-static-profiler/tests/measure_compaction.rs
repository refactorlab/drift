//! Reports the wire-size delta between the 1.1 interned form and the
//! legacy 1.0 inline form on a real scan. Skipped by default unless
//! `DRIFT_MEASURE_PATH` points at a `.json` produced by `scan` /
//! `analyze-root`. Useful for ad-hoc benchmarking — not a regression
//! gate.
//!
//! Usage:
//!     DRIFT_MEASURE_PATH=/tmp/rc-python-scan.json \
//!     cargo test --release --test measure_compaction -- --nocapture

use drift_static_profiler::compact::read_report;

#[test]
fn measure_compaction_ratio() {
    let Ok(path) = std::env::var("DRIFT_MEASURE_PATH") else {
        eprintln!("(skipping: set DRIFT_MEASURE_PATH to enable)");
        return;
    };
    let bytes = std::fs::read(&path).expect("read input scan");
    let compact_size = bytes.len();
    let report = read_report(&bytes).expect("parse scan");
    let mut legacy_buf: Vec<u8> = Vec::with_capacity(compact_size * 2);
    serde_json::to_writer_pretty(&mut legacy_buf, &report).expect("legacy serialize");
    let legacy_size = legacy_buf.len();
    let pct = 100.0 * (legacy_size as f64 - compact_size as f64) / legacy_size as f64;
    eprintln!();
    eprintln!("scan: {}", path);
    eprintln!(
        "compact (1.1):  {:>11} bytes  ({:>6.1} MB)",
        compact_size,
        compact_size as f64 / 1024.0 / 1024.0
    );
    eprintln!(
        "legacy  (1.0):  {:>11} bytes  ({:>6.1} MB)",
        legacy_size,
        legacy_size as f64 / 1024.0 / 1024.0
    );
    eprintln!("reduction:     {:>6.1}%", pct);
}
