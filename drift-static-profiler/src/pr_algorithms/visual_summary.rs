//! §3.8 — Visual summary (risks quadrant chart + key files mindmap).

use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::mermaid::{Mindmap, MindmapNode, QuadrantChart, QuadrantItem};
use crate::pr_algorithms::pr_signals::{PrSignals, SignalTier};
use crate::pr_algorithms::types::*;
use crate::insights::FindingKind;
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
        let lik = (duplication_count as f64 / 10.0).clamp(0.4, 1.0);
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
        let lik = (n as f64 / 5.0).clamp(0.4, 1.0);
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
        let lik = (n as f64 / 4.0).clamp(0.5, 1.0);
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
        let lik = (high_complexity_count as f64 / 5.0).clamp(0.5, 1.0);
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

/// Map a finding's review tier onto the risk-quadrant severity axis.
/// Critical lands in the top band (act-before-merge when likelihood is
/// also high), Important mid, Minor low.
fn severity_axis(tier: SignalTier) -> f64 {
    match tier {
        SignalTier::Critical => 0.9,
        SignalTier::Important => 0.6,
        SignalTier::Minor => 0.4,
    }
}

/// Human label for a finding kind on a chart. A few high-frequency kinds
/// get a hand-tuned name; the rest fall back to the snake_case slug with
/// underscores spaced out (deterministic, no per-kind maintenance burden).
fn pretty_kind(kind: FindingKind) -> String {
    match kind {
        FindingKind::NPlusOne => "N+1 query".into(),
        FindingKind::BlockingInAsync => "Blocking call in async".into(),
        FindingKind::ExpensiveCompute => "Expensive compute".into(),
        FindingKind::MissingCaching => "Missing caching".into(),
        FindingKind::LogAmplification => "Log amplification".into(),
        FindingKind::AuthCryptoAntipattern => "Auth/crypto antipattern".into(),
        FindingKind::MigrationSafety => "Unsafe migration".into(),
        other => other.as_str().replace('_', " "),
    }
}

/// VS3 (highest-signal source): turn the top PR findings — the issues the
/// profiler ACTUALLY detected in the changed code — into risk items, ranked
/// by impact. Likelihood is the finding's confidence; severity is its tier.
/// This is what makes the risk map reflect real problems instead of PR-shape
/// heuristics (file count, LOC).
fn risks_from_findings(signals: &PrSignals, max: usize) -> Vec<RiskItem> {
    signals
        .findings
        .iter()
        .take(max)
        .map(|f| {
            let likelihood = (f.confidence * 100.0).round() / 100.0;
            let severity = severity_axis(f.tier);
            let basename = f.file.rsplit('/').next().unwrap_or(&f.file);
            RiskItem {
                // The location is already in the `(basename:line)` suffix,
                // so collapse a synthetic `function` to a bare token here
                // rather than re-embedding file/line. See `symbol_label`.
                label: format!(
                    "{} · {} ({basename}:{})",
                    pretty_kind(f.kind),
                    crate::pr_algorithms::symbol_label::humanize_symbol_token(&f.function),
                    f.line
                ),
                likelihood,
                severity,
                quadrant: RiskCandidate {
                    likelihood: f.confidence,
                    severity,
                }
                .quadrant(),
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

#[derive(Default)]
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
    /// VS3: the PR-scoped structured findings. `None` for callers that
    /// don't have them (legacy/tests) — then the risk map keeps its
    /// heuristic-only behavior.
    pub signals: Option<&'a PrSignals>,
}


pub fn compute(inputs: Inputs<'_>) -> VisualSummary {
    let mut risks_items: Vec<RiskItem> = Vec::new();
    // VS3: lead with the issues actually detected in the changed code,
    // ranked by impact. These are the highest-signal risk items, so they
    // come first; the heuristic risks below pad the map when findings are
    // sparse.
    if let Some(sig) = inputs.signals {
        risks_items.extend(risks_from_findings(sig, 6));
    }
    risks_items.extend(score_risks(
        inputs.changed_files,
        inputs.commit_messages,
        inputs.affected_roots_count,
    ));
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
            ..Default::default()
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

    /// VS3: a real Critical finding (N+1) in changed code becomes the
    /// leading risk item and lands in "Act before merge".
    #[test]
    fn findings_drive_act_before_merge_risk() {
        use crate::insights::{Effort, Finding, FindingKind, Severity};
        use crate::pr_algorithms::pr_signals::{collect, QualityBar};
        use crate::pr_algorithms::test_helpers::{mk_node, with_findings};

        let node = with_findings(
            mk_node("load_orders", "src/orders.rs"),
            vec![Finding {
                kind: FindingKind::NPlusOne,
                severity: Severity::High,
                effort: Effort::Medium,
                confidence: 0.9,
                line: 12,
                message: "n+1".into(),
                evidence: vec![],
                remediation: None,
                byte_range: None,
                fidelity: None,
                fusion_paths: vec![],
                predicted_sql: None,
                originating_orm: None,
            }],
        );
        let signals = collect(&[node], &["src/orders.rs".to_string()], &QualityBar::default());
        let inputs = Inputs {
            changed_files: &[cf("src/orders.rs", 10)],
            signals: Some(&signals),
            ..Default::default()
        };
        let r = compute(inputs);
        let item = r.risks.items.iter().find(|it| it.label.contains("N+1 query"));
        assert!(
            item.is_some(),
            "expected an N+1 risk item, got {:?}",
            r.risks.items.iter().map(|i| &i.label).collect::<Vec<_>>(),
        );
        assert!(matches!(item.unwrap().quadrant, Quadrant::ActBeforeMerge));
    }

    /// The "Uncovered roots" risk item shows the already-humanized strings
    /// (file basename / `anon <file:line>`) it receives from tests_in_graph,
    /// and never the raw synthetic names.
    #[test]
    fn uncovered_roots_humanized_strings_survive_into_risk_label() {
        let uncovered = vec!["anon <keymap.ts:20>".to_string(), "keymap.ts".to_string()];
        let inputs = Inputs {
            uncovered_roots: &uncovered,
            ..Default::default()
        };
        let r = compute(inputs);
        let item = r
            .risks
            .items
            .iter()
            .find(|it| it.label.starts_with("Uncovered roots"))
            .expect("uncovered-roots risk item");
        // The label is rendered through safe_label downstream; assert the
        // pre-render form here carries the humanized strings verbatim.
        assert!(item.label.contains("anon <keymap.ts:20>"), "{}", item.label);
        assert!(item.label.contains("keymap.ts"), "{}", item.label);
        assert!(
            !item.label.contains("<module>") && !item.label.contains("<anonymous@"),
            "raw synthetic names leaked: {}",
            item.label
        );
    }

    /// A finding on an anonymous symbol collapses its `function` token to
    /// `anon` in the risk map (location stays in the `(file:line)` suffix);
    /// no raw `<anonymous@N>` leaks.
    #[test]
    fn synthetic_finding_function_is_humanized_in_risk_map() {
        use crate::insights::{Effort, Finding, FindingKind, Severity};
        use crate::pr_algorithms::pr_signals::{collect, QualityBar};
        use crate::pr_algorithms::test_helpers::with_findings;

        let mut node = with_findings(
            crate::pr_algorithms::test_helpers::mk_node("<anonymous@12>", "src/orders.rs"),
            vec![Finding {
                kind: FindingKind::NPlusOne,
                severity: Severity::High,
                effort: Effort::Medium,
                confidence: 0.9,
                line: 12,
                message: "n+1".into(),
                evidence: vec![],
                remediation: None,
                byte_range: None,
                fidelity: None,
                fusion_paths: vec![],
                predicted_sql: None,
                originating_orm: None,
            }],
        );
        node.line = 12;
        let signals = collect(&[node], &["src/orders.rs".to_string()], &QualityBar::default());
        let inputs = Inputs {
            changed_files: &[cf("src/orders.rs", 10)],
            signals: Some(&signals),
            ..Default::default()
        };
        let r = compute(inputs);
        let item = r
            .risks
            .items
            .iter()
            .find(|it| it.label.contains("N+1 query"))
            .expect("N+1 risk item");
        assert!(item.label.contains("· anon ("), "function should collapse to `anon`: {}", item.label);
        assert!(
            !item.label.contains("<anonymous@") && !item.label.contains("‹anonymous"),
            "raw synthetic name leaked: {}",
            item.label
        );
    }
}
