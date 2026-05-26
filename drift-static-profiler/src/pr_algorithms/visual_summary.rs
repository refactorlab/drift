//! §3.8 — Visual summary (risks quadrant chart + key files mindmap).

use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::mermaid::{Mindmap, MindmapNode, QuadrantChart, QuadrantItem};
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy)]
struct RiskCandidate {
    likelihood: f64,
    severity: f64,
}

impl RiskCandidate {
    fn quadrant(self) -> Quadrant {
        if self.severity >= 0.5 && self.likelihood >= 0.5 {
            Quadrant::ActBeforeMerge
        } else if self.severity >= 0.5 && self.likelihood < 0.5 {
            Quadrant::MonitorClosely
        } else if self.severity < 0.5 && self.likelihood >= 0.5 {
            Quadrant::DocumentAndShip
        } else {
            Quadrant::Acceptable
        }
    }
}

fn score_risks(
    changed_files: &[ChangedFile],
    commit_messages: &[String],
    affected_roots_count: usize,
) -> Vec<RiskItem> {
    let mut out: Vec<RiskItem> = Vec::new();
    let n_files = changed_files.len();

    if n_files > 0 {
        let lik = (n_files as f64 / 100.0).min(1.0);
        let sev = (n_files as f64 / 200.0 + 0.3).min(1.0);
        let r = RiskCandidate {
            likelihood: lik,
            severity: sev,
        };
        out.push(RiskItem {
            label: format!("PR size · {n_files} files"),
            likelihood: (lik * 100.0).round() / 100.0,
            severity: (sev * 100.0).round() / 100.0,
            quadrant: r.quadrant(),
        });
    }

    let breaking = commit_messages
        .iter()
        .filter(|m| {
            m.contains("BREAKING CHANGE")
                || m.lines().any(|ln| {
                    if let Some((head, _)) = ln.trim().split_once(':') {
                        head.ends_with('!')
                    } else {
                        false
                    }
                })
        })
        .count();
    if breaking > 0 {
        let r = RiskCandidate {
            likelihood: 0.85,
            severity: 0.9,
        };
        out.push(RiskItem {
            label: format!("Breaking changes · {breaking} commit(s)"),
            likelihood: 0.85,
            severity: 0.9,
            quadrant: r.quadrant(),
        });
    }

    if affected_roots_count >= 5 {
        let lik = (0.4 + affected_roots_count as f64 / 50.0).min(1.0);
        let sev = (0.5 + affected_roots_count as f64 / 40.0).min(1.0);
        let r = RiskCandidate {
            likelihood: lik,
            severity: sev,
        };
        out.push(RiskItem {
            label: format!("Wide blast radius · {affected_roots_count} roots affected"),
            likelihood: (lik * 100.0).round() / 100.0,
            severity: (sev * 100.0).round() / 100.0,
            quadrant: r.quadrant(),
        });
    }

    let additions: usize = changed_files.iter().map(|f| f.additions).sum();
    let touched_tests = changed_files.iter().any(|f| f.path.to_lowercase().contains("test"));
    if additions >= 200 && !touched_tests {
        let r = RiskCandidate {
            likelihood: 0.6,
            severity: 0.7,
        };
        out.push(RiskItem {
            label: format!("Untested code · +{additions} LOC, no test files"),
            likelihood: 0.6,
            severity: 0.7,
            quadrant: r.quadrant(),
        });
    }
    out
}

/// VS1: lift signals already computed by `pr_review_ext.*` into the
/// risk-quadrant items. Without this, the risks block stays sparse
/// (often 1 item) on real PRs even when the scanner found multiple
/// problems elsewhere in the output.
fn risks_from_ext_signals(
    duplication_count: usize,
    uncovered_roots: &[String],
    reliability_gaps: &[String],
    high_complexity_count: usize,
) -> Vec<RiskItem> {
    let mut out: Vec<RiskItem> = Vec::new();

    if duplication_count > 0 {
        // Likelihood scales with cluster count (more dups = more
        // confidence the duplication is real). Severity is moderate
        // — duplicates aren't bugs, but they're maintenance burden.
        let lik = (duplication_count as f64 / 10.0).min(1.0).max(0.4);
        out.push(RiskItem {
            label: format!("Code duplication · {duplication_count} cluster(s)"),
            likelihood: (lik * 100.0).round() / 100.0,
            severity: 0.45,
            quadrant: RiskCandidate {
                likelihood: lik,
                severity: 0.45,
            }
            .quadrant(),
        });
    }

    if !uncovered_roots.is_empty() {
        // Untested affected roots are a real correctness risk —
        // higher severity than duplication.
        let n = uncovered_roots.len();
        let lik = (n as f64 / 5.0).min(1.0).max(0.4);
        let sev = (0.55 + n as f64 / 20.0).min(0.85);
        let preview: Vec<&str> = uncovered_roots
            .iter()
            .take(2)
            .map(|s| s.as_str())
            .collect();
        let label_extra = if n > 2 {
            format!("{} + {} more", preview.join(", "), n - 2)
        } else {
            preview.join(", ")
        };
        out.push(RiskItem {
            label: format!("Uncovered roots · {n} ({label_extra})"),
            likelihood: (lik * 100.0).round() / 100.0,
            severity: (sev * 100.0).round() / 100.0,
            quadrant: RiskCandidate {
                likelihood: lik,
                severity: sev,
            }
            .quadrant(),
        });
    }

    if !reliability_gaps.is_empty() {
        // NFR gaps (no retry/timeout/circuit-breaker markers in a
        // root's subtree) — failure-mode risk.
        let n = reliability_gaps.len();
        let lik = (n as f64 / 4.0).min(1.0).max(0.5);
        let sev = (0.6 + n as f64 / 10.0).min(0.9);
        out.push(RiskItem {
            label: format!("Reliability gaps · {n} root(s) lack retry/timeout/fallback"),
            likelihood: (lik * 100.0).round() / 100.0,
            severity: (sev * 100.0).round() / 100.0,
            quadrant: RiskCandidate {
                likelihood: lik,
                severity: sev,
            }
            .quadrant(),
        });
    }

    if high_complexity_count > 0 {
        // High cyclomatic complexity in changed code — moderate risk.
        let lik = (high_complexity_count as f64 / 5.0).min(1.0).max(0.5);
        out.push(RiskItem {
            label: format!("High-complexity functions · {high_complexity_count}"),
            likelihood: (lik * 100.0).round() / 100.0,
            severity: 0.55,
            quadrant: RiskCandidate {
                likelihood: lik,
                severity: 0.55,
            }
            .quadrant(),
        });
    }

    out
}

/// Scrub characters that confuse mermaid's quadrantChart label
/// parser. Newlines + double-quotes are the main hazards; we also
/// drop control chars (NUL, BEL, etc.) that no legitimate identifier
/// should contain but a malicious commit message could inject.
fn escape_mermaid_quoted_label(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_control() {
                ' '
            } else if c == '"' {
                '\''
            } else if c == '\\' {
                '/'
            } else {
                c
            }
        })
        .collect()
}

/// Build the typed `QuadrantChart`. The mermaid-rendering is done by
/// the type's `.render()` method; we just supply the structure.
fn build_risks_quadrant(items: &[RiskItem]) -> QuadrantChart {
    QuadrantChart {
        title: "Risk Map".into(),
        x_axis_low: "Low likelihood".into(),
        x_axis_high: "High likelihood".into(),
        y_axis_low: "Low severity".into(),
        y_axis_high: "High severity".into(),
        quadrant_1: "Act before merge".into(),
        quadrant_2: "Monitor closely".into(),
        quadrant_3: "Acceptable".into(),
        quadrant_4: "Document & ship".into(),
        items: items
            .iter()
            .map(|it| QuadrantItem {
                label: it.label.clone(),
                x: it.likelihood,
                y: it.severity,
            })
            .collect(),
    }
}

fn sanitize_unit(x: f64) -> f64 {
    if x.is_nan() || x.is_infinite() {
        0.0
    } else {
        x.clamp(0.0, 1.0)
    }
}

fn collect_impact(
    entries: &[CallTreeNode],
    changed_paths: &[String],
) -> BTreeMap<String, usize> {
    let mut impact: BTreeMap<String, usize> = BTreeMap::new();
    // DFS, suffix-matching each node's file against the changed list.
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(node) = stack.pop() {
        let f = &node.file;
        for p in changed_paths {
            if f.ends_with(p) {
                *impact.entry(p.clone()).or_default() += 1;
                break;
            }
        }
        for c in &node.children {
            stack.push(c);
        }
    }
    if impact.is_empty() {
        // No entry-tree match → fall back to listing the changed
        // paths with impact 1 each.
        for p in changed_paths {
            impact.insert(p.clone(), 1);
        }
    }
    impact
}

/// VS2: dominant-category lookup. Walk entries; for each node whose
/// file is `path`, accumulate its `categories_reached` counts. The
/// category with the highest aggregate count is that file's group.
/// Falls back to top-level dir when no categories are present.
fn dominant_category_for_files(
    entries: &[CallTreeNode],
    paths: &std::collections::HashSet<String>,
) -> std::collections::HashMap<String, String> {
    use std::collections::HashMap;
    let mut tally: HashMap<String, HashMap<String, usize>> = HashMap::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        // Match this node's file against any changed path (suffix match,
        // same as elsewhere in the algorithms).
        let matched: Option<String> = paths
            .iter()
            .find(|p| n.file.ends_with(p.as_str()))
            .cloned();
        if let Some(p) = matched {
            let per = tally.entry(p).or_default();
            for (cat, count) in &n.categories_reached {
                *per.entry(cat.clone()).or_default() += count;
            }
        }
        for c in &n.children {
            stack.push(c);
        }
    }
    let mut out: HashMap<String, String> = HashMap::new();
    for (path, cats) in tally {
        if let Some((winner, _)) = cats.iter().max_by_key(|kv| kv.1) {
            out.insert(path, winner.clone());
        }
    }
    out
}

fn group_key_files(
    impact: BTreeMap<String, usize>,
    entries: &[CallTreeNode],
) -> Vec<KeyFileGroup> {
    let mut top: Vec<(String, usize)> = impact.into_iter().collect();
    top.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    top.truncate(8);

    // VS2: derive a category-name per file. Files whose call-tree
    // nodes mostly reach `db` get grouped under "db", `network`
    // under "network", etc. This matches the HTML mockup's
    // semantic-grouping intent (it used "Wire format" /
    // "Observability" / "Desktop UI" — we use drift's category
    // taxonomy: db / cache / network / queue / log / io / compute).
    let path_set: std::collections::HashSet<String> =
        top.iter().map(|(p, _)| p.clone()).collect();
    let path_category = dominant_category_for_files(entries, &path_set);

    let mut groups: BTreeMap<String, Vec<KeyFile>> = BTreeMap::new();
    for (path, score) in top {
        // Prefer semantic category; fall back to top-level dir.
        let group_name = path_category
            .get(&path)
            .cloned()
            .unwrap_or_else(|| {
                path.split_once('/')
                    .map(|(h, _)| h.to_string())
                    .unwrap_or_else(|| "other".into())
            });
        groups
            .entry(group_name)
            .or_default()
            .push(KeyFile {
                path: path.clone(),
                why: format!("{score} root(s) reach this file"),
            });
    }
    groups
        .into_iter()
        .map(|(name, files)| KeyFileGroup { name, files })
        .collect()
}

/// Build the typed `Mindmap`. Root → groups → file leaves.
fn build_key_files_mindmap(groups: &[KeyFileGroup]) -> Mindmap {
    Mindmap {
        root: MindmapNode {
            label: "Affected files".into(),
            is_root: true,
            children: groups
                .iter()
                .map(|g| MindmapNode {
                    label: g.name.clone(),
                    is_root: false,
                    children: g
                        .files
                        .iter()
                        .map(|f| MindmapNode {
                            label: f
                                .path
                                .rsplit('/')
                                .next()
                                .unwrap_or(&f.path)
                                .to_string(),
                            is_root: false,
                            children: vec![],
                        })
                        .collect(),
                })
                .collect(),
        },
    }
}

pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    pub changed_files: &'a [ChangedFile],
    pub commit_messages: &'a [String],
    pub affected_roots_count: usize,
    // VS1: cross-fed signals from `pr_review_ext.*`. Optional so
    // callers that don't have the ext block yet (e.g. tests) still
    // work — empty slices = no extra risks contributed.
    pub duplication_count: usize,
    pub uncovered_roots: &'a [String],
    pub reliability_gaps: &'a [String],
    pub high_complexity_count: usize,
}

impl<'a> Default for Inputs<'a> {
    fn default() -> Self {
        Self {
            entries: &[],
            changed_files: &[],
            commit_messages: &[],
            affected_roots_count: 0,
            duplication_count: 0,
            uncovered_roots: &[],
            reliability_gaps: &[],
            high_complexity_count: 0,
        }
    }
}

pub fn compute(inputs: Inputs<'_>) -> VisualSummary {
    let mut risks_items = score_risks(
        inputs.changed_files,
        inputs.commit_messages,
        inputs.affected_roots_count,
    );
    // VS1: append the extra risks lifted from pr_review_ext signals.
    risks_items.extend(risks_from_ext_signals(
        inputs.duplication_count,
        inputs.uncovered_roots,
        inputs.reliability_gaps,
        inputs.high_complexity_count,
    ));
    let risks_quadrant = build_risks_quadrant(&risks_items);
    let risks = RisksBlock {
        mermaid: risks_quadrant.render(),
        structured: Some(risks_quadrant),
        items: risks_items,
    };

    let changed_paths: Vec<String> = inputs
        .changed_files
        .iter()
        .map(|f| f.path.clone())
        .collect();
    let impact = collect_impact(inputs.entries, &changed_paths);
    let groups = group_key_files(impact, inputs.entries);
    let key_mindmap = build_key_files_mindmap(&groups);
    let key_files = KeyFilesBlock {
        mermaid: key_mindmap.render(),
        structured: Some(key_mindmap),
        groups,
    };

    VisualSummary { risks, key_files }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::counts::ChangedFile;

    fn cf(path: &str, add: usize) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some("modified".into()),
            additions: add,
            deletions: 0,
        }
    }

    #[test]
    fn breaking_change_in_act_before_merge() {
        let inputs = Inputs {
            changed_files: &[cf("a.py", 30)],
            commit_messages: &["feat!: drop legacy\n\nBREAKING CHANGE: foo()".into()],
            affected_roots_count: 1,
            ..Default::default()
        };
        let r = compute(inputs);
        assert!(
            r.risks
                .items
                .iter()
                .any(|it| matches!(it.quadrant, Quadrant::ActBeforeMerge))
        );
    }

    #[test]
    fn large_additions_no_tests_flagged() {
        let inputs = Inputs {
            changed_files: &[cf("big.py", 500)],
            ..Default::default()
        };
        let r = compute(inputs);
        assert!(
            r.risks
                .items
                .iter()
                .any(|it| it.label.starts_with("Untested code"))
        );
    }

    #[test]
    fn mermaid_strings_emitted() {
        let inputs = Inputs {
            changed_files: &[cf("a.py", 1)],
            ..Default::default()
        };
        let r = compute(inputs);
        assert!(r.risks.mermaid.contains("quadrantChart"));
        assert!(r.key_files.mermaid.contains("mindmap"));
    }

    /// Sanitizer guards: NaN / infinity / control characters must
    /// not leak into the mermaid payload. JSON has no NaN, and
    /// mermaid's `quadrantChart` parser rejects them.
    #[test]
    fn sanitizer_clamps_nan_and_inf() {
        assert_eq!(sanitize_unit(f64::NAN), 0.0);
        assert_eq!(sanitize_unit(f64::INFINITY), 0.0);
        assert_eq!(sanitize_unit(f64::NEG_INFINITY), 0.0);
        assert_eq!(sanitize_unit(2.0), 1.0); // clamp above
        assert_eq!(sanitize_unit(-0.5), 0.0); // clamp below
        assert_eq!(sanitize_unit(0.5), 0.5); // pass-through inside range
    }

    #[test]
    fn label_escape_scrubs_control_chars() {
        let dirty = "foo\nbar\"baz\\qux\x07";
        let clean = escape_mermaid_quoted_label(dirty);
        assert!(!clean.contains('\n'));
        assert!(!clean.contains('"'));
        assert!(!clean.contains('\\'));
        assert!(!clean.contains('\x07'));
    }
}
