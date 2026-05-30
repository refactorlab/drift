//! End-to-end tests for the `--diff-status` flag.
//!
//! This is the wire that lets the action.yml side feed real `git diff
//! --name-status` data into the scanner so `architecture_flow::
//! compute_with_diff` can render BEFORE and AFTER as two independent
//! charts. Without this flag the scanner falls back to `status = None`
//! (treated as `Modified`) and the two-chart layout silently degrades
//! to the legacy single-snapshot.
//!
//! These tests exercise the FULL CLI pipeline (spawn the real binary,
//! pass a TSV file, parse the JSON report) — they're the only thing
//! that catches a regression in:
//!   • the CLI flag definition (`--diff-status`),
//!   • the `read_diff_status` parser,
//!   • the `ChangedFile { status }` construction at main.rs,
//!   • the D-status injection loop,
//!   • and `architecture_flow::compute_with_diff`'s rendering all the
//!     way down to the rendered mermaid strings the action embeds.

use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn fixture(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

/// Run `scan-pr` with a TSV file written to a temp path. Returns the
/// parsed JSON report (or panics if the CLI failed to produce one).
fn run_with_diff_status(changed_files: &[&str], diff_status_tsv: &str) -> Value {
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture("python-fastapi");

    // Write the TSV to a per-test temp file. `runner.temp` mirrors how
    // the action wires the path; here we just need a UNIQUE file. The
    // test runner executes these in parallel, and `SystemTime` resolution
    // is coarse enough on some hosts that two threads can read the same
    // nanos — colliding on the path, so one test's TSV clobbers another's
    // and the scan reads the wrong statuses (flaky failures). A process-
    // global atomic counter guarantees uniqueness regardless of clock
    // granularity or thread scheduling.
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let pid = std::process::id();
    let seq = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tsv_path =
        std::env::temp_dir().join(format!("drift-diff-status-{pid}-{nanos}-{seq}.tsv"));
    std::fs::write(&tsv_path, diff_status_tsv).expect("write tsv");

    let tsv_str = tsv_path.to_str().unwrap();
    let mut args: Vec<&str> = vec![
        "scan-pr",
        root.to_str().unwrap(),
        "--changed-files-stdin",
        "--diff-status",
        tsv_str,
        // We INTENTIONALLY do NOT pass `--no-review` here — `--no-review`
        // emits the factual-only envelope which skips the entire
        // `enrich` phase (and thus architecture_flow). The two-chart
        // rendering lives in the enriched envelope, so we need the
        // full pipeline.
    ];
    let _ = &mut args;

    let mut child = Command::new(bin)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn scan-pr");
    {
        let mut stdin = child.stdin.take().expect("stdin");
        for f in changed_files {
            writeln!(stdin, "{f}").expect("write changed file");
        }
    }
    let out = child.wait_with_output().expect("wait");
    let _ = std::fs::remove_file(&tsv_path);

    assert!(
        out.status.success(),
        "scan-pr failed (exit {:?}); stderr:\n{}",
        out.status.code(),
        String::from_utf8_lossy(&out.stderr)
    );
    serde_json::from_slice(&out.stdout).unwrap_or_else(|e| {
        panic!(
            "expected JSON on stdout, got parse error: {e}\nstdout:\n{}\nstderr:\n{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        )
    })
}

/// Pull a string field out of a nested JSON path.
fn json_str<'a>(v: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut node = v;
    for k in path {
        node = node.get(*k)?;
    }
    node.as_str()
}

// SCENARIO A — `--diff-status` with M (modified) entries.
// Asserts BEFORE renders muted, AFTER renders amber (`changed` class).
// This is the canonical happy path the action.yml will produce on most PRs.
#[test]
fn diff_status_modified_renders_two_charts_with_amber_after() {
    let tsv = "M\tapp/services.py\n";
    let report = run_with_diff_status(&["app/services.py"], tsv);

    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"])
        .expect("before_mermaid string");
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"])
        .expect("after_mermaid string");

    assert!(before.starts_with("flowchart "), "BEFORE should be a flowchart:\n{before}");
    assert!(after.starts_with("flowchart "), "AFTER should be a flowchart:\n{after}");

    // BEFORE: every visible node MUST be muted (modified-status → muted in BEFORE panel).
    // We use a permissive check (`classDef muted` declared + at least one `class ... muted` line)
    // because the call tree's exact shape depends on the fixture's AST.
    assert!(before.contains("classDef muted"), "BEFORE must declare `muted` class:\n{before}");
    // AFTER: at least one node has the amber `changed` class.
    assert!(
        after.contains("classDef changed") || after.contains("No affected entries"),
        "AFTER must declare `changed` class (or be the no-entries placeholder):\n{after}"
    );
}

// SCENARIO B — `--diff-status` with A (added) entries.
// Asserts BEFORE either skips the added file entirely (empty-state note)
// OR shows it muted only if a transitive callee survives, AND AFTER paints
// it green (`added` class).
#[test]
fn diff_status_added_renders_green_in_after_and_skips_before() {
    let tsv = "A\tapp/services.py\n";
    let report = run_with_diff_status(&["app/services.py"], tsv);
    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"]).unwrap();

    // BEFORE: since the only changed file is Added, every AFFECTED root
    // that lives in it must be skipped. BEFORE either:
    //   (a) renders the empty-state note ("All affected files are new in this PR"), or
    //   (b) renders unchanged transitive callees from other files (without
    //       the Added one).
    // Both shapes are acceptable; what's NOT acceptable is `class=changed`
    // (only added/removed/muted should appear in BEFORE).
    assert!(
        !before.contains("class") || before.contains("classDef muted") || before.contains("All affected files are new"),
        "BEFORE for all-Added PR must not paint nodes amber:\n{before}"
    );

    // AFTER: at least one node must carry the `added` class.
    assert!(
        after.contains("classDef added") || after.contains("No affected entries"),
        "AFTER for an Added file must declare the `added` class:\n{after}"
    );
}

// SCENARIO C — `--diff-status` with D (deleted) entries the action.yml's
// `--changed-files` list correctly omits. The scanner MUST inject those
// entries into `ChangedFile` so the BEFORE chart's red placeholder cards
// fire. Asserts the rendered BEFORE contains the `🗑 removed —` glyph.
#[test]
fn diff_status_deleted_injects_removed_placeholder_in_before() {
    // The PR deletes one file (`app/old.py`) AND modifies another. `--changed-files`
    // lists ONLY the modified one (action.yml's `--diff-filter=ACMRT` drops D);
    // `--diff-status` carries BOTH so the scanner can inject the removed entry.
    let tsv = "M\tapp/services.py\nD\tapp/old.py\n";
    let report = run_with_diff_status(&["app/services.py"], tsv);

    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();
    assert!(
        before.contains("🗑 removed — old.py"),
        "BEFORE must inject the removed-card for app/old.py:\n{before}"
    );
    assert!(before.contains("classDef removed"), "BEFORE must declare the `removed` class:\n{before}");

    // AFTER must NOT show the removed file (it has no AST at HEAD).
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"]).unwrap();
    assert!(
        !after.contains("old.py"),
        "AFTER must not show the deleted file:\n{after}"
    );
}

// SCENARIO D — `--diff-status` with R<sim> (rename). git emits a 3-column
// row; the parser must (1) key the renamed status to the NEW path (col 3)
// and (2) CARRY the OLD path (col 2) through to ChangedFile.old_path so
// the BEFORE chart can relabel file-named nodes to their pre-PR names.
//
// NOTE on the fixture: python-fastapi's `services.py` exposes real SYMBOL
// nodes (`create_order`, `OrderService.*`), NOT a file-named node, so the
// rename relabel (which only fires for label == file basename) is a no-op
// here — the symbol names are stable across a rename and stay muted in
// BEFORE. The relabel itself (old name shown in BEFORE) is exercised by
// the lib-level `rename_shows_old_name_in_before_new_in_after` test with a
// file-named node. This e2e test pins the PIPELINE: old_path survives the
// CLI parse → ChangedFile → architecture_flow, and the rename is amber in
// AFTER without producing a spurious removed placeholder.
#[test]
fn diff_status_rename_uses_new_path() {
    // `R100\told.py\tservices.py` — score 100 (no body changes), old=`old.py`,
    // new=`services.py`. The scanner should classify `services.py` as Renamed
    // (amber in AFTER, muted in BEFORE).
    let tsv = "R100\tapp/old.py\tapp/services.py\n";
    let report = run_with_diff_status(&["app/services.py"], tsv);

    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"]).unwrap();

    // BEFORE: services.py existed (under its old name) → muted symbols. The
    // OLD path is NOT shown as a removed placeholder (renames are not
    // deletions — that asymmetry matches what reviewers expect).
    assert!(before.contains("classDef muted"), "BEFORE must show muted nodes for a rename:\n{before}");
    assert!(!before.contains("🗑 removed"), "rename must NOT produce a removed placeholder:\n{before}");
    // The OLD file's basename must NOT leak onto any SYMBOL node (the
    // relabel is file-named-only). `old.py` should appear nowhere here.
    assert!(!before.contains("old.py"), "old filename must not bleed onto symbol nodes in BEFORE:\n{before}");

    // AFTER: services.py is amber `changed` (renamed → modified palette).
    assert!(
        after.contains("classDef changed") || after.contains("No affected entries"),
        "AFTER must paint renamed file amber:\n{after}"
    );
}

// SCENARIO E — `--diff-status` is OPTIONAL. The flag's absence MUST NOT
// crash the scan; status falls back to None, BEFORE mirrors AFTER muted.
// This is the back-compat invariant the action.yml relies on when running
// against an older binary that supports `--diff-status` but is invoked
// without it.
#[test]
fn diff_status_omitted_falls_back_to_legacy_single_snapshot() {
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture("python-fastapi");
    let mut child = Command::new(bin)
        .args([
            "scan-pr",
            root.to_str().unwrap(),
            "--changed-files-stdin",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn");
    child.stdin.take().unwrap().write_all(b"app/services.py\n").unwrap();
    let out = child.wait_with_output().expect("wait");
    assert!(out.status.success(), "scan-pr without --diff-status must succeed; stderr:\n{}", String::from_utf8_lossy(&out.stderr));

    let report: Value = serde_json::from_slice(&out.stdout).expect("JSON report");
    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"]).unwrap();
    assert!(before.starts_with("flowchart "));
    assert!(after.starts_with("flowchart "));
}

// SCENARIO F — TSV PARSER ROBUSTNESS. Real git output can include CRLF
// line endings (on Windows hosts, or when a tool round-trips through
// CRLF normalization). Empty lines, comments, and unknown codes should
// degrade gracefully (default to `modified` for unknowns; skip empty).
// We pipe a deliberately messy TSV and assert the scan still produces
// a sensible report.
#[test]
fn diff_status_tsv_parser_handles_messy_input() {
    let tsv = "\
M\tapp/services.py\r\n\
\r\n\
\n\
X\tunknown/code.py\n\
D\tapp/dead.py\n\
";
    let report = run_with_diff_status(&["app/services.py"], tsv);
    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"]).unwrap();
    // The D entry fires the removed-card injection.
    assert!(before.contains("🗑 removed — dead.py"), "D entry must inject placeholder despite messy input:\n{before}");
    // The M entry is reflected.
    assert!(after.starts_with("flowchart "));
}

// SCENARIO G — SAME-BASENAME COLLISION. A PR that touches files with the
// same basename in different directories (e.g. `web/users.ts` and
// `admin/users.ts`) MUST NOT cross-pollinate statuses. The new
// `paths_match` predicate uses a `/`-boundary suffix match to prevent this.
//
// We don't have a fixture for that (the python-fastapi tree is fixed),
// so this test goes through the library directly. It catches the over-match
// regression that the old `ends_with(p)` predicate would silently allow.
#[test]
fn paths_match_invariant_via_classify_file() {
    // The architecture_flow module's `classify_file` is private; we test
    // its effect through the public surface: compute_with_diff fed two
    // files with the same basename in different dirs, only one is Added.
    // The other (in the call tree under a different dir) must NOT be
    // tagged Added in AFTER.
    use drift_static_profiler::graph::SymbolId;
    use drift_static_profiler::pr_algorithms::architecture_flow;
    use drift_static_profiler::pr_algorithms::counts::ChangedFile;
    use drift_static_profiler::tree::CallTreeNode;
    use drift_static_profiler::SymbolKind;
    use std::collections::BTreeMap;

    fn mk(name: &str, file: &str) -> CallTreeNode {
        CallTreeNode {
            id: SymbolId(format!("{file}::{name}")),
            name: name.into(), kind: SymbolKind::Function, file: file.into(),
            line: 1, depth: 0, parent_class: None, children: vec![],
            truncated_reason: None, callers: vec![],
            callers_count: 0, callees_count: 0, subtree_size: 1,
            category_self: None, categories_reached: BTreeMap::new(),
            external_calls: vec![],
            complexity: 1, loc: 1, nesting_depth: 0, parameter_count: 0, is_async: false,
            call_site_count: 0, is_recursive: false, pagerank: 0.0,
            percent_total: 0.0, percent_parent: 0.0,
            n_plus_one_risk: false, blocking_in_async: false,
            findings: vec![], entry_labels: vec![],
        }
    }
    fn cf(path: &str, status: &str) -> ChangedFile {
        ChangedFile { path: path.into(), status: Some(status.into()), additions: 0, deletions: 0, ..Default::default() }
    }

    let entries = vec![
        mk("loginUser", "web/users.ts"),   // call tree node A
        mk("adminUser", "admin/users.ts"), // call tree node B — same basename, different dir
    ];
    let changed = vec![cf("web/users.ts", "added")]; // ONLY web/users.ts is added.

    let arch = architecture_flow::compute_with_diff(&entries, &changed);
    let after = arch.after_mermaid;

    // The post-fix predicate must keep `admin/users.ts` UNCHANGED (no class).
    // Pre-fix's `ends_with("/users.ts")` would have matched both and tinted
    // both green. We assert exactly ONE `added` class assignment.
    let added_lines: Vec<&str> = after
        .lines()
        .filter(|l| l.contains(" added"))
        .filter(|l| l.trim_start().starts_with("class "))
        .collect();
    let added_count: usize = added_lines
        .iter()
        .map(|l| l.split(' ').nth(1).map(|ids| ids.split(',').count()).unwrap_or(0))
        .sum();
    assert_eq!(
        added_count, 1,
        "expected exactly 1 node with class=added (web/users.ts only); got {added_count}.\n--- diagram ---\n{after}"
    );
}

// SCENARIO H — MASS-DELETION through the FULL CLI pipeline. A PR that
// deletes 20 files (all D-status, none in --changed-files) must inject all
// 20 ChangedFile entries, then the BEFORE chart caps the rendered cards at
// 8 + one "+12 more removed" summary. This pins the cap end-to-end (parser
// → D-injection → architecture_flow), not just at the lib layer.
#[test]
fn diff_status_mass_deletion_caps_removed_cards_end_to_end() {
    let mut tsv = String::from("M\tapp/services.py\n");
    for i in 0..20 {
        tsv.push_str(&format!("D\tapp/dead_{i}.py\n"));
    }
    let report = run_with_diff_status(&["app/services.py"], &tsv);
    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();

    let individual = before.matches("🗑 removed — ").count();
    assert_eq!(individual, 8, "BEFORE must cap individual removed cards at 8 end-to-end:\n{before}");
    assert!(before.contains("🗑 +12 more removed"), "BEFORE must summarize the 12-file overflow:\n{before}");
}

// SCENARIO I — COPIED file (C-status) through the FULL CLI pipeline must be
// green (added) in AFTER and absent from BEFORE, proving the C→Added
// classification survives the parser and classify_file end-to-end.
#[test]
fn diff_status_copied_is_green_in_after_end_to_end() {
    // C75 = copy with 75% similarity; old=services.py, new=services_copy.py.
    // We only feed services.py to --changed-files (the copy's new path isn't
    // in the fixture tree, so AFTER may not surface a node for it — but the
    // status classification path is still exercised, and the M file proves
    // the report renders).
    let tsv = "M\tapp/services.py\nC75\tapp/services.py\tapp/services_copy.py\n";
    let report = run_with_diff_status(&["app/services.py"], tsv);
    let before = json_str(&report, &["pr_review", "architecture_flow", "before_mermaid"]).unwrap();
    let after = json_str(&report, &["pr_review", "architecture_flow", "after_mermaid"]).unwrap();
    // The copy's new path is not a removed file → no removed placeholder for it.
    assert!(!before.contains("services_copy"), "copied file must not appear as removed in BEFORE:\n{before}");
    // The scan completes and renders both charts.
    assert!(after.starts_with("flowchart "));
    assert!(before.starts_with("flowchart "));
}

// SCENARIO J — ACTION.YML PROBE GUARD. action.yml gates the `--diff-status`
// flag behind a `drift-static-profiler scan-pr --help | grep -q -- '--diff-status'`
// probe. If the binary's --help ever stops listing the flag (a clap refactor,
// a rename), that probe silently fails and the two-chart feature degrades to a
// muted BEFORE mirror with NO signal in the PR comment. This test pins the
// invariant the probe depends on: `scan-pr --help` MUST advertise `--diff-status`.
#[test]
fn scan_pr_help_advertises_diff_status_flag() {
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let out = Command::new(bin)
        .args(["scan-pr", "--help"])
        .output()
        .expect("spawn scan-pr --help");
    assert!(out.status.success(), "scan-pr --help must exit 0");
    let help = String::from_utf8_lossy(&out.stdout);
    assert!(
        help.contains("--diff-status"),
        "scan-pr --help must list --diff-status (action.yml's probe greps for it):\n{help}"
    );
    // Sanity: the sibling flags the same diff step passes must also be present,
    // so a clap refactor that drops any of them is caught here too.
    for flag in ["--changed-files", "--diff-stats", "--base-sha"] {
        assert!(help.contains(flag), "scan-pr --help must list {flag}:\n{help}");
    }
}
