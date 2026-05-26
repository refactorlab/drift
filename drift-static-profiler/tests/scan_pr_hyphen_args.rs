//! Regression test for the GitHub Action's `scan-pr` step aborting with
//! `error: unexpected argument '- ' found` (exit 2).
//!
//! Root cause: `--pr-title` / `--pr-body` carry raw PR text, which routinely
//! begins with `-` (a markdown bullet `- item`, a `---` front-matter rule, a
//! `-fix` title…). clap rejects a hyphen-leading *value* in the space form
//! (`--pr-body "- x"`) unless the arg opts into `allow_hyphen_values`, so the
//! scan died during argument parsing — before any code ran. These tests pin
//! the fix from BOTH sides of the contract:
//!   * the CLI now sets `allow_hyphen_values` (space form must work), and
//!   * the action now uses the `--flag=value` form (which is hyphen-immune
//!     even without the CLI flag).

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn fixture(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

/// Run `scan-pr` against the python-fastapi fixture with the given extra
/// args, feeding one changed file on stdin. Returns (success, stdout, stderr).
fn run_scan_pr(extra: &[&str]) -> (bool, Vec<u8>, String) {
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture("python-fastapi");

    let mut args: Vec<&str> = vec![
        "scan-pr",
        root.to_str().unwrap(),
        "--changed-files-stdin",
        "--no-review", // parsing is what we're testing; skip enrichment for speed
    ];
    args.extend_from_slice(extra);

    let mut child = Command::new(bin)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn scan-pr");
    child
        .stdin
        .take()
        .expect("stdin")
        .write_all(b"app/services.py\n")
        .expect("write stdin");
    let out = child.wait_with_output().expect("wait");
    (
        out.status.success(),
        out.stdout,
        String::from_utf8_lossy(&out.stderr).into_owned(),
    )
}

/// The space form (`--pr-title "- x"`) — exactly how the action passed it
/// when the bug fired — must now parse and run for every hyphen-leading
/// shape a real PR description takes.
#[test]
fn space_form_accepts_hyphen_leading_title_and_body() {
    // (label, title, body) — each value deliberately starts with `-`.
    let cases = [
        ("markdown bullet", "- shorten the title", "- Added X\n- Fixed Y\n"),
        ("double dash", "-- terse", "-- note about the change"),
        ("front-matter rule", "-fix typo", "---\ntype: chore\n---\nbody"),
    ];

    for (label, title, body) in cases {
        let (ok, stdout, stderr) = run_scan_pr(&["--pr-title", title, "--pr-body", body]);
        assert!(
            ok,
            "[{label}] scan-pr must accept hyphen-leading --pr-title/--pr-body \
             (space form); stderr:\n{stderr}",
        );
        assert!(
            !stderr.contains("unexpected argument"),
            "[{label}] clap still rejected a hyphen-leading value:\n{stderr}",
        );
        // Parsing succeeded → the scan ran → stdout is a valid JSON report.
        serde_json::from_slice::<serde_json::Value>(&stdout)
            .unwrap_or_else(|e| panic!("[{label}] expected valid JSON on stdout: {e}"));
    }
}

/// The `--flag=value` form the action now uses is hyphen-immune by
/// construction (clap takes everything after `=` literally). This locks in
/// the action-side half of the fix so it can't silently regress.
#[test]
fn equals_form_accepts_hyphen_leading_body() {
    let (ok, stdout, stderr) = run_scan_pr(&["--pr-body=- a bullet body"]);
    assert!(
        ok,
        "scan-pr must accept --pr-body=<hyphen value>; stderr:\n{stderr}",
    );
    serde_json::from_slice::<serde_json::Value>(&stdout).expect("valid JSON on stdout");
}
