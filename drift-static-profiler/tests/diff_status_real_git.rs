//! TRUE end-to-end test: a REAL git repo → the EXACT `git diff` commands
//! action.yml runs → the scanner's `--diff-status` flag → the rendered
//! BEFORE/AFTER mermaid charts → the REAL mermaid parser.
//!
//! Every other diff-status test feeds HAND-WRITTEN TSV. This one proves the
//! single assumption all of those rest on: that *real git output* from
//! action.yml's command actually parses and flows through to correct charts.
//! It also guards the `--find-renames` fix — without it, a runner with
//! `diff.renames=false` collapses a rename into add+delete, which this test
//! would catch (the renamed file would wrongly appear as a removed card).
//!
//! AUTO-SKIP: skips cleanly when `git` or `node` aren't on PATH, so offline
//! / minimal CI stays green; runs for real wherever both are present.

use std::path::{Path, PathBuf};
use std::process::Command;

fn have(cmd: &str) -> bool {
    Command::new(cmd)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn git(repo: &Path, args: &[&str]) -> (bool, String, String) {
    // `-c` flags force a hermetic, config-independent git: identity set,
    // and crucially `diff.renames=false` to PROVE our explicit
    // `--find-renames` overrides a hostile user config.
    let mut full: Vec<&str> = vec![
        "-c", "user.email=t@t.co",
        "-c", "user.name=t",
        "-c", "commit.gpgsign=false",
        "-c", "diff.renames=false",
    ];
    full.extend_from_slice(args);
    let out = Command::new("git")
        .args(&full)
        .current_dir(repo)
        .output()
        .expect("spawn git");
    (
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    )
}

fn write(repo: &Path, rel: &str, body: &str) {
    let p = repo.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, body).unwrap();
}

fn unique_repo() -> PathBuf {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let pid = std::process::id();
    std::env::temp_dir().join(format!("drift-realgit-{pid}-{seq}"))
}

fn validator_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../action/scripts/validate-mermaid.mjs")
}

/// Validate one mermaid string through the real parser. Returns:
///   Some(true)  = valid · Some(false) = invalid · None = skipped (no node/deps)
fn validate_mermaid(mmd: &str) -> Option<bool> {
    let script = validator_script();
    if !script.exists() || !have("node") {
        return None;
    }
    let p = std::env::temp_dir().join(format!(
        "drift-realgit-mmd-{}-{}.mmd",
        std::process::id(),
        mmd.len()
    ));
    std::fs::write(&p, mmd).unwrap();
    let out = Command::new("node").arg(&script).arg(&p).output().ok()?;
    let _ = std::fs::remove_file(&p);
    match out.status.code() {
        Some(2) => None, // deps not installed → skip
        Some(0) => Some(true),
        _ => Some(false),
    }
}

#[test]
fn real_git_diff_drives_two_charts_end_to_end() {
    if !have("git") {
        eprintln!("SKIP: git not on PATH");
        return;
    }
    let repo = unique_repo();
    let _ = std::fs::remove_dir_all(&repo);
    std::fs::create_dir_all(&repo).unwrap();

    // ── Base revision: a small python call graph ─────────────────────────
    write(&repo, "app/main.py", "from app.services import create_order\n\ndef handler():\n    return create_order()\n");
    write(&repo, "app/services.py", "from app.db import save\n\ndef create_order():\n    return validate() and save()\n\ndef validate():\n    return True\n");
    write(&repo, "app/db.py", "def save():\n    return 1\n");
    write(&repo, "app/legacy_audit.py", "def audit():\n    return 'old'\n"); // will be DELETED
    write(&repo, "app/old_helpers.py", "def helper():\n    return 2\n");     // will be RENAMED
    write(&repo, "app/extra.py", "def extra():\n    return 3\n");            // will be MODIFIED

    assert!(git(&repo, &["init", "-q"]).0, "git init");
    assert!(git(&repo, &["add", "-A"]).0, "git add base");
    assert!(git(&repo, &["commit", "-qm", "base"]).0, "git commit base");
    let base = git(&repo, &["rev-parse", "HEAD"]).1.trim().to_string();

    // ── PR revision: add + modify + delete + rename ──────────────────────
    write(&repo, "app/new_feature.py", "def new_feature():\n    return 42\n"); // ADDED
    write(&repo, "app/extra.py", "def extra():\n    return 4  # changed\n");    // MODIFIED
    assert!(git(&repo, &["rm", "-q", "app/legacy_audit.py"]).0, "git rm legacy");
    assert!(git(&repo, &["mv", "app/old_helpers.py", "app/new_helpers.py"]).0, "git mv rename");
    assert!(git(&repo, &["add", "-A"]).0, "git add pr");
    assert!(git(&repo, &["commit", "-qm", "pr"]).0, "git commit pr");
    let head = git(&repo, &["rev-parse", "HEAD"]).1.trim().to_string();

    // ── EXACT action.yml diff commands (with --find-renames, under a
    //    hostile diff.renames=false config the git() helper injects) ──────
    let (ok_changed, changed_txt, _) = git(&repo, &[
        "diff", "--name-only", "--find-renames", "--diff-filter=ACMRT", &base, &head,
    ]);
    assert!(ok_changed, "git diff --name-only failed");
    let (ok_status, status_tsv, _) = git(&repo, &[
        "diff", "--name-status", "--find-renames", "--diff-filter=ACMRTD", &base, &head,
    ]);
    assert!(ok_status, "git diff --name-status failed");

    // CRITICAL: --find-renames must have overridden diff.renames=false, so
    // the rename is an `R` row (NOT a separate A+D pair). This is the bug
    // the action.yml fix prevents.
    assert!(
        status_tsv.lines().any(|l| l.starts_with("R") && l.contains("old_helpers.py") && l.contains("new_helpers.py")),
        "real git must emit an R<sim> rename row even under diff.renames=false (--find-renames):\n{status_tsv}"
    );
    assert!(
        status_tsv.lines().any(|l| l.starts_with("D") && l.contains("legacy_audit.py")),
        "deleted file must be a D row:\n{status_tsv}"
    );
    assert!(
        !status_tsv.contains("D\tapp/old_helpers.py"),
        "rename must NOT appear as a delete of the old path:\n{status_tsv}"
    );

    // Write the real git output to the files the scanner reads.
    let changed_path = repo.join("changed.txt");
    let status_path = repo.join("status.tsv");
    std::fs::write(&changed_path, &changed_txt).unwrap();
    std::fs::write(&status_path, &status_tsv).unwrap();

    // ── Run scan-pr against the REAL repo with the REAL diff outputs ─────
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let out = Command::new(bin)
        .args([
            "scan-pr",
            repo.to_str().unwrap(),
            "--changed-files",
            changed_path.to_str().unwrap(),
            "--diff-status",
            status_path.to_str().unwrap(),
        ])
        .output()
        .expect("spawn scan-pr");
    assert!(
        out.status.success(),
        "scan-pr failed (exit {:?}); stderr:\n{}",
        out.status.code(),
        String::from_utf8_lossy(&out.stderr)
    );
    let report: serde_json::Value =
        serde_json::from_slice(&out.stdout).expect("scan-pr stdout must be JSON");

    let af = &report["pr_review"]["architecture_flow"];
    let before = af["before_mermaid"].as_str().expect("before_mermaid");
    let after = af["after_mermaid"].as_str().expect("after_mermaid");

    // ── Assertions: real git → correct two charts ───────────────────────
    // 1. The DELETED file became a removed-card in BEFORE (real `D\t…` row
    //    → main.rs D-injection → build_before_flowchart placeholder).
    assert!(
        before.contains("🗑 removed — legacy_audit.py"),
        "deleted file must appear as a removed card in BEFORE:\n{before}"
    );
    // 2. The RENAME must NOT have produced a removed card for the old path
    //    (it's a rename, not a deletion — guards the --find-renames fix).
    assert!(
        !before.contains("🗑 removed — old_helpers.py"),
        "a rename must NOT render the old path as a removed card:\n{before}"
    );
    // 3. The added file must NOT be a removed card anywhere.
    assert!(
        !before.contains("new_feature.py"),
        "added file must be absent from BEFORE:\n{before}"
    );
    // 4. Both charts are non-empty flowcharts.
    assert!(before.starts_with("flowchart "), "BEFORE must be a flowchart:\n{before}");
    assert!(after.starts_with("flowchart "), "AFTER must be a flowchart:\n{after}");

    // 5. Both charts parse through the REAL mermaid grammar.
    for (name, mmd) in [("BEFORE", before), ("AFTER", after)] {
        match validate_mermaid(mmd) {
            Some(true) => {}
            Some(false) => panic!("[{name}] real-git chart REJECTED by mermaid:\n{mmd}"),
            None => eprintln!("SKIP: mermaid validator unavailable for [{name}]"),
        }
    }

    let _ = std::fs::remove_dir_all(&repo);
}
