//! §3.1 — Discrete PR counts (features / bug_fixes / issues_resolved / new_test_files).
//!
//! Algorithm: Conventional Commits subject parser + GitHub linking
//! keywords. Inputs are the commit-message list (from
//! `git log $BASE..$HEAD --format=%B%x00`) and a structured
//! changed-files list. No drift-internal state needed.
//!
//! Cites:
//!   - Conventional Commits v1.0.0 — <https://www.conventionalcommits.org/en/v1.0.0/>
//!   - GitHub linking keywords — <https://docs.github.com/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue>

use crate::pr_algorithms::constants::{test_filename_patterns, test_filename_regexes};
use crate::pr_algorithms::types::{CountChip, PrCounts};
use regex::Regex;
use std::sync::OnceLock;

#[derive(Debug, Clone, Default)]
pub struct ChangedFile {
    pub path: String,
    /// "added" | "modified" | "renamed" | "copied" | "changed" | "removed"
    pub status: Option<String>,
    pub additions: usize,
    pub deletions: usize,
    /// For `status = "renamed"` (and "copied"), the file's PRE-PR path —
    /// i.e. what the file was called BEFORE this PR. git's
    /// `--name-status` emits `R<sim>\told\tnew`; `read_diff_status`
    /// keeps `new` as `path` and stashes `old` here. The architecture
    /// flow's BEFORE chart uses it to render a renamed file under its
    /// OLD name ("what the code was") instead of its HEAD name.
    /// `None` for every other status.
    pub old_path: Option<String>,
}

fn re_conventional() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"^(?P<type>[a-z]+)(\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<subject>.+)$")
            .expect("conventional commit regex")
    })
}

fn re_fix_kw() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)\b(?:fix|fixes|fixed)\s+#(?P<num>\d+)").unwrap())
}

fn re_resolve_kw() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)\b(?:close|closes|closed|resolve|resolves|resolved)\s+#(?P<num>\d+)")
            .unwrap()
    })
}

// Test-file regex compilation moved to
// `constants::test_filename_regexes()` so `counts` and
// `tests_in_graph` share one compiled set instead of each maintaining
// their own. `counts.rs` only uses the regexes; it no longer needs
// the OnceLock + Regex import for that purpose.

#[derive(Default)]
struct CommitTally {
    feat_subjects: Vec<String>,
    fix_subjects: Vec<String>,
    fix_refs: Vec<u32>,
    resolve_refs: Vec<u32>,
    #[allow(dead_code)]
    breaking: usize,
}

fn classify_commits(messages: &[String], pr_body: Option<&str>) -> CommitTally {
    use std::collections::BTreeSet;
    let mut tally = CommitTally::default();
    let mut fix_set = BTreeSet::new();
    let mut res_set = BTreeSet::new();

    for msg in messages {
        let mut lines = msg.lines();
        let subject = lines.next().unwrap_or("").trim();
        let body: String = lines.collect::<Vec<_>>().join("\n");

        if let Some(caps) = re_conventional().captures(subject) {
            let t = &caps["type"];
            if caps.name("breaking").is_some() {
                tally.breaking += 1;
            }
            let subj = caps.name("subject").map(|m| m.as_str()).unwrap_or("");
            match t {
                "feat" => tally.feat_subjects.push(subj.to_string()),
                "fix" => tally.fix_subjects.push(subj.to_string()),
                _ => {}
            }
        }

        let whole = format!("{subject}\n{body}");
        for c in re_fix_kw().captures_iter(&whole) {
            if let Ok(n) = c["num"].parse::<u32>() {
                fix_set.insert(n);
            }
        }
        for c in re_resolve_kw().captures_iter(&whole) {
            if let Ok(n) = c["num"].parse::<u32>() {
                res_set.insert(n);
            }
        }
    }

    // Also scan the PR body — GitHub's "Linked Issues" UI surfaces
    // `Fixes #N` / `Resolves #N` from the PR description, not just
    // the commits. Real PRs frequently put the linking keyword in the
    // PR body and never in a commit message.
    if let Some(body) = pr_body {
        for c in re_fix_kw().captures_iter(body) {
            if let Ok(n) = c["num"].parse::<u32>() {
                fix_set.insert(n);
            }
        }
        for c in re_resolve_kw().captures_iter(body) {
            if let Ok(n) = c["num"].parse::<u32>() {
                res_set.insert(n);
            }
        }
    }

    tally.fix_refs = fix_set.into_iter().collect();
    tally.resolve_refs = res_set.into_iter().collect();
    tally
}

fn count_new_test_files(files: &[ChangedFile]) -> (usize, Vec<String>) {
    let rxs = test_filename_regexes();
    let mut matches: Vec<String> = Vec::new();
    for f in files {
        // If status is provided, only count newly-added test files.
        if let Some(s) = &f.status {
            if s != "added" {
                continue;
            }
        }
        let base = f
            .path
            .rsplit('/')
            .next()
            .unwrap_or(&f.path);
        if rxs.iter().any(|rx| rx.is_match(base)) {
            matches.push(f.path.clone());
        }
    }
    let n = matches.len();
    matches.truncate(5);
    (n, matches)
}

/// V4: feat/bug heuristic when commit messages aren't supplied.
/// Look at the changed-files list to infer SOME signal so the counts
/// chips aren't unconditionally 0 on Action runs without --commits.
///
/// Heuristics (deliberately conservative; this is a fallback):
///   - feat:  ≥1 added file under `*/handlers/*`, `*/routes/*`,
///            `*/controllers/*`, or with `*service*` / `*endpoint*`
///            in its basename → infer 1 feature signal.
///   - fix:   ≥1 file in `*/errors/*` / `*/exceptions/*` / containing
///            `error` or `fix` in path → infer 1 fix signal.
fn heuristic_feat_fix(changed_files: &[ChangedFile]) -> (usize, usize) {
    let mut feat = 0;
    let mut fix = 0;
    for f in changed_files {
        let p = f.path.to_lowercase();
        let is_added = f.status.as_deref().map(|s| s == "added").unwrap_or(false);
        let handler_like = p.contains("/handlers/")
            || p.contains("/routes/")
            || p.contains("/controllers/")
            || p.contains("service")
            || p.contains("endpoint");
        let bug_like = p.contains("/errors/")
            || p.contains("/exceptions/")
            || p.contains("error")
            || p.contains("/bugfix/");
        if handler_like && is_added && feat == 0 {
            feat = 1;
        }
        if bug_like && fix == 0 {
            fix = 1;
        }
    }
    (feat, fix)
}

pub fn compute(
    commit_messages: &[String],
    changed_files: &[ChangedFile],
    pr_body: Option<&str>,
) -> PrCounts {
    let mut cls = classify_commits(commit_messages, pr_body);
    let (n_new_tests, sample) = count_new_test_files(changed_files);

    // V4: when commits are absent, fall back to path-based heuristics
    // so the chips aren't always 0. This is INFERRED — confidence is
    // low — but a non-zero baseline beats permanent zeros for the
    // Action's first impression.
    if commit_messages.is_empty() {
        let (feat_h, fix_h) = heuristic_feat_fix(changed_files);
        if feat_h > 0 {
            cls.feat_subjects.push("(inferred from added handler file)".to_string());
        }
        if fix_h > 0 {
            cls.fix_subjects.push("(inferred from error-path file change)".to_string());
        }
    }

    let n_features = cls.feat_subjects.len();
    let features = CountChip {
        value: n_features,
        label: "New features".to_string(),
        detail: if cls.feat_subjects.is_empty() {
            "no `feat:` commits".to_string()
        } else {
            cls.feat_subjects
                .iter()
                .take(4)
                .cloned()
                .collect::<Vec<_>>()
                .join(" · ")
        },
        source: format!(
            "{n_features} commits with `feat:` prefix (Conventional Commits v1.0.0)"
        ),
    };

    let n_fix_subjects = cls.fix_subjects.len();
    let n_fix_refs = cls.fix_refs.len();
    let mut fix_detail_parts: Vec<String> = Vec::new();
    if n_fix_subjects > 0 {
        fix_detail_parts.push(format!("{} `fix:` commits", n_fix_subjects));
    }
    if !cls.fix_refs.is_empty() {
        fix_detail_parts.push(format!(
            "Fixes {}",
            cls.fix_refs
                .iter()
                .take(4)
                .map(|n| format!("#{n}"))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    let bug_fixes = CountChip {
        value: n_fix_subjects + n_fix_refs,
        label: "Bug fixes".to_string(),
        detail: if fix_detail_parts.is_empty() {
            "no `fix:` commits or `Fixes #N` refs".to_string()
        } else {
            fix_detail_parts.join(" · ")
        },
        source: "commit subjects with `fix:` + body keywords `fix|fixes|fixed #N`".to_string(),
    };

    let issues_resolved = CountChip {
        value: cls.resolve_refs.len(),
        label: "Issues resolved".to_string(),
        detail: if cls.resolve_refs.is_empty() {
            "no `Closes #N` / `Resolves #N` refs".to_string()
        } else {
            format!(
                "Resolves {}",
                cls.resolve_refs
                    .iter()
                    .take(4)
                    .map(|n| format!("#{n}"))
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        },
        source: "commit body keywords `close|closes|closed|resolve|resolves|resolved #N`"
            .to_string(),
    };

    let new_test_files = CountChip {
        value: n_new_tests,
        label: "New test files".to_string(),
        detail: if sample.is_empty() {
            "no added files matched test patterns".to_string()
        } else {
            sample
                .iter()
                .map(|p| p.rsplit('/').next().unwrap_or(p).to_string())
                .collect::<Vec<_>>()
                .join(" · ")
        },
        source: format!(
            "changed_files matched against {} language-specific filename patterns \
             (pytest/go/jest/junit/cargo/scala/kotlin)",
            test_filename_patterns().len()
        ),
    };

    PrCounts {
        features,
        bug_fixes,
        issues_resolved,
        new_test_files,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cf(path: &str, status: Option<&str>) -> ChangedFile {
        ChangedFile {
            path: path.to_string(),
            status: status.map(String::from),
            additions: 0,
            deletions: 0,
            ..Default::default()
        }
    }

    #[test]
    fn feat_and_fix_classification() {
        let commits = vec![
            "feat: add live↔static join".to_string(),
            "feat(profiler): emit interned wire format".to_string(),
            "fix: handle empty PR diff\n\nFixes #123".to_string(),
            "chore: bump deps".to_string(),
        ];
        let result = compute(&commits, &[], None);
        assert_eq!(result.features.value, 2);
        assert_eq!(result.bug_fixes.value, 2); // `fix:` + `Fixes #123`
    }

    #[test]
    fn resolves_and_closes_count_issues() {
        let commits = vec![
            "feat: foo\n\nCloses #11".to_string(),
            "fix: bar\n\nResolves #22".to_string(),
            "chore: just a chore\n\nFixes #33".to_string(),
        ];
        let result = compute(&commits, &[], None);
        assert_eq!(result.issues_resolved.value, 2);
        // chore `Fixes #33` lands in bug_fixes count.
        assert_eq!(result.bug_fixes.value, 2);
    }

    #[test]
    fn new_test_files_match_patterns() {
        let files = vec![
            cf("app/services.py", Some("modified")),
            cf("tests/test_services.py", Some("added")),
            cf("internal/foo_test.go", Some("added")),
            cf("ui/widget.test.ts", Some("added")),
            cf("src/lib/UserTest.java", Some("added")),
            cf("src/lib/HelperService.java", Some("modified")),
        ];
        let result = compute(&[], &files, None);
        assert_eq!(result.new_test_files.value, 4);
    }

    #[test]
    fn empty_inputs_yield_zero_chips_not_missing() {
        let r = compute(&[], &[], None);
        assert_eq!(r.features.value, 0);
        assert_eq!(r.bug_fixes.value, 0);
        assert_eq!(r.issues_resolved.value, 0);
        assert_eq!(r.new_test_files.value, 0);
    }

    /// V4: when commit messages are empty, the path-based heuristic
    /// infers a feature signal from added handler/route/controller files.
    #[test]
    fn v4_heuristic_infers_feature_from_added_handler_file() {
        let files = vec![cf("src/handlers/orders_handler.kt", Some("added"))];
        let r = compute(&[], &files, None);
        assert_eq!(
            r.features.value, 1,
            "expected 1 inferred feature from added handler file, got {}",
            r.features.value
        );
    }

    /// V4: when commits are PRESENT, do NOT fire the heuristic (it's
    /// strictly a fallback for the missing-commits case).
    #[test]
    fn v4_heuristic_silent_when_commits_present() {
        let files = vec![cf("src/handlers/orders_handler.kt", Some("added"))];
        let r = compute(&["chore: misc".into()], &files, None);
        assert_eq!(r.features.value, 0); // no `feat:` in the commit
    }

    /// PR body should contribute issue refs even when commit messages
    /// are silent — matches GitHub's own "Linked Issues" UI behavior.
    #[test]
    fn pr_body_contributes_issue_refs() {
        let body = "This PR introduces the OrderService. Resolves #11. Also Closes #12.";
        let r = compute(&["chore: rearrange".into()], &[], Some(body));
        assert_eq!(r.issues_resolved.value, 2);
    }

    /// PR body `Fixes #N` rolls into bug_fixes (same as commit-body
    /// `Fixes #N`), matching GitHub's linking semantics.
    #[test]
    fn pr_body_fixes_rolls_into_bug_fixes() {
        let body = "Fixes #42.";
        let r = compute(&[], &[], Some(body));
        assert_eq!(r.bug_fixes.value, 1);
    }
}
