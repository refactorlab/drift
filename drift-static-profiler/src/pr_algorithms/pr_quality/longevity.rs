//! pr_quality::longevity — how well will this code age? (higher = ages well)
//!
//! Weighted mean of three risks, inverted to a goodness score
//! (PR_QUALITY_RESEARCH §4/§5/§8.5):
//! - **fragility** (0.45) — afferent-dominant blast surface from the call
//!   graph: `0.45·fan_in + 0.30·centrality + 0.15·HK + 0.10·fan_out`, each
//!   log1p-saturated (power-law-aware); `centrality = pagerank × N` (NDepend
//!   Rank precedent). PR-level = pagerank-weighted mean.
//! - **net-debt** (0.35) — SQALE-style signed debt delta, reusing the
//!   `value_money` economics (bug-hours by tier + maintenance vs `fix:`/
//!   `refactor:` paydown + net deletions); sub-score = debt-ratio over added LOC.
//! - **burden** (0.20) — TODO/SATD + hardcoded-value density from
//!   `source_scan` (textual; coupling lives in fragility to avoid double-count).

use super::{band_for, clamp01, log1p_sat, source_scan};
use crate::pr_algorithms::constants::{
    bug_hours_critical, bug_hours_important, bug_hours_minor, dev_hour_usd,
    maint_hours_per_finding, maint_hours_per_loc, pq_num,
};
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::in_pr_changed_files;
use crate::pr_algorithms::pr_signals::{PrSignals, SignalTier};
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::BTreeMap;
use std::path::Path;

pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    pub changed_files: &'a [ChangedFile],
    pub commit_messages: &'a [String],
    pub signals: &'a PrSignals,
    pub repo_root: Option<&'a Path>,
    pub total_symbols: usize,
}

fn walk(entries: &[CallTreeNode]) -> Vec<&CallTreeNode> {
    let mut out = Vec::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        out.push(n);
        for c in &n.children {
            stack.push(c);
        }
    }
    out
}

fn bug_hours_for(tier: SignalTier) -> f64 {
    match tier {
        SignalTier::Critical => bug_hours_critical(),
        SignalTier::Important => bug_hours_important(),
        SignalTier::Minor => bug_hours_minor(),
    }
}

fn commit_prefix_count(messages: &[String], prefix: &str) -> usize {
    messages
        .iter()
        .filter(|m| {
            m.lines()
                .next()
                .map(|l| l.to_lowercase().starts_with(prefix))
                .unwrap_or(false)
        })
        .count()
}

/// Per-node fragility ∈ [0,1] (afferent-dominant; PR_QUALITY_RESEARCH §4).
fn fragility_node(n: &CallTreeNode, total_symbols: usize) -> f64 {
    let fan_in_s = log1p_sat(n.call_site_count as f64, pq_num("longevity.fanin_sat"));
    let fan_out_s = log1p_sat(n.callees_count as f64, pq_num("longevity.fanout_sat"));
    let centrality_s = if total_symbols > 0 {
        log1p_sat(n.pagerank * total_symbols as f64, pq_num("longevity.centrality_sat"))
    } else {
        clamp01(n.percent_total / 100.0)
    };
    // Henry-Kafura information-flow: loc × (fan_in × fan_out)², log-compressed.
    let hk = n.loc as f64 * (n.call_site_count as f64 * n.callees_count as f64).powi(2);
    let hk_s = log1p_sat(hk, pq_num("longevity.hk_ifc_sat"));
    clamp01(
        pq_num("longevity.fragility_w_fanin") * fan_in_s
            + pq_num("longevity.fragility_w_centrality") * centrality_s
            + pq_num("longevity.fragility_w_hk") * hk_s
            + pq_num("longevity.fragility_w_fanout") * fan_out_s,
    )
}

pub fn compute(input: Inputs<'_>) -> QualityDimension {
    let changed_paths: Vec<String> = input.changed_files.iter().map(|f| f.path.clone()).collect();
    let added: usize = input.changed_files.iter().map(|f| f.additions).sum();
    let deleted: usize = input.changed_files.iter().map(|f| f.deletions).sum();

    let changed: Vec<&CallTreeNode> = walk(input.entries)
        .into_iter()
        .filter(|n| in_pr_changed_files(&n.file, &changed_paths))
        .collect();

    // ── fragility: pagerank-weighted mean (+ track max) ───────────────
    let (mut wsum, mut fsum, mut fmax) = (0.0_f64, 0.0_f64, 0.0_f64);
    for n in &changed {
        let f = fragility_node(n, input.total_symbols);
        let w = n.pagerank.max(0.0);
        wsum += w;
        fsum += w * f;
        fmax = fmax.max(f);
    }
    let fragility = if wsum > 1e-12 {
        clamp01(fsum / wsum)
    } else if changed.is_empty() {
        0.0
    } else {
        clamp01(changed.iter().map(|n| fragility_node(n, input.total_symbols)).sum::<f64>() / changed.len() as f64)
    };

    // ── net debt (SQALE-style, signed) ────────────────────────────────
    let findings_n = input.signals.findings.len() as f64;
    let bug_hours: f64 = input.signals.findings.iter().map(|f| bug_hours_for(f.tier)).sum();
    let maintenance_hours = findings_n * maint_hours_per_finding() + added as f64 * maint_hours_per_loc();
    let debt_introduced_h = bug_hours + maintenance_hours;

    let fix_refactor = commit_prefix_count(input.commit_messages, "fix:")
        + commit_prefix_count(input.commit_messages, "refactor:");
    let cleanup_loc = deleted.saturating_sub(added) as f64;
    let debt_resolved_h = fix_refactor as f64 * bug_hours_important() + cleanup_loc * maint_hours_per_loc();

    let net_debt_h = debt_introduced_h - debt_resolved_h;
    let net_debt_usd = net_debt_h * dev_hour_usd();
    // SQALE debt ratio over the PR's own new code (clean-as-you-code).
    let debt_ratio = clamp01(
        (net_debt_h * 60.0) / (pq_num("longevity.sqale_cost_per_loc_min") * added.max(1) as f64),
    );

    // ── maintenance burden (textual: TODO + hardcoded values) ─────────
    let mut text = source_scan::FileTextStats::default();
    let mut scanned_any = false;
    for f in input.changed_files {
        if let Some(s) = source_scan::scan_file(input.repo_root, &f.path) {
            text.add(&s);
            scanned_any = true;
        }
    }
    let code_lines = text.code_lines.max(1) as f64;
    let todo_density = text.todo_markers as f64 / code_lines;
    let hardcode_density = text.magic_literals as f64 / code_lines;
    // 3× the SATD baseline density → full burden on that term.
    let todo_s = clamp01(todo_density / (3.0 * pq_num("longevity.todo_density_sat")));
    let hardcode_s = clamp01(hardcode_density / pq_num("longevity.hardcode_density_sat"));
    let burden = clamp01(0.5 * todo_s + 0.5 * hardcode_s);

    // ── compose (risk) then invert to a goodness score ────────────────
    let risk = clamp01(
        pq_num("longevity.w_fragility") * fragility
            + pq_num("longevity.w_debt") * debt_ratio
            + pq_num("longevity.w_burden") * burden,
    );
    let score = clamp01(1.0 - risk);

    let no_signal = changed.is_empty() && input.signals.findings.is_empty();
    let source_expected_but_missing = !scanned_any && input.repo_root.is_some();
    let confidence = if no_signal || source_expected_but_missing {
        Confidence::Low
    } else {
        Confidence::Medium
    };

    let mut notes = vec![];
    if !scanned_any {
        notes.push("Maintenance-burden term used graph/debt signals only (source text unavailable).".to_string());
    }

    QualityDimension {
        score,
        band: band_for(score, true).to_string(),
        direction: if score >= 0.5 { Direction::Up } else { Direction::Down },
        confidence,
        components: vec![
            comp("fragility", fragility, pq_num("longevity.w_fragility"), "afferent blast surface (fan-in/centrality/HK)"),
            comp("net_debt", debt_ratio, pq_num("longevity.w_debt"), "SQALE debt ratio over new code (signed delta)"),
            comp("burden", burden, pq_num("longevity.w_burden"), "TODO + hardcoded-value density"),
        ],
        formula: "longevity = 1 − (0.45·fragility + 0.35·net_debt_ratio + 0.20·burden)".into(),
        inputs: {
            let mut m = BTreeMap::new();
            m.insert("fragility_max".into(), InputValue::Number(round2(fmax)));
            m.insert("net_debt_hours".into(), InputValue::Number(round2(net_debt_h)));
            m.insert("net_debt_usd".into(), InputValue::Number(round2(net_debt_usd)));
            m.insert("debt_introduced_hours".into(), InputValue::Number(round2(debt_introduced_h)));
            m.insert("debt_resolved_hours".into(), InputValue::Number(round2(debt_resolved_h)));
            m.insert("todo_markers".into(), InputValue::Number(text.todo_markers as f64));
            m.insert("magic_literals".into(), InputValue::Number(text.magic_literals as f64));
            m
        },
        kv: vec![],
        sources: vec![
            SourceCitation {
                label: "fragility".into(),
                source: "CK/Henry-Kafura coupling + NDepend Rank (PageRank×N)".into(),
                source_link: "https://www.ndepend.com/docs/code-metrics".into(),
            },
            SourceCitation {
                label: "net debt".into(),
                source: "SonarQube SQALE debt ratio (30 min/LOC)".into(),
                source_link: "https://docs.sonarsource.com/sonarqube-server/user-guide/code-metrics/metrics-definition".into(),
            },
        ],
        notes,
    }
}

fn comp(key: &str, value: f64, weight: f64, detail: &str) -> QualityComponent {
    QualityComponent {
        key: key.into(),
        value: round2(value),
        weight,
        detail: detail.into(),
    }
}

fn round2(x: f64) -> f64 {
    let x = if x.is_finite() { x } else { 0.0 };
    (x * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::insights::{Effort, Finding, FindingKind, Severity};
    use crate::pr_algorithms::pr_signals::{collect, QualityBar};
    use crate::pr_algorithms::test_helpers::{mk_node, with_findings};

    fn cf(path: &str, add: usize, del: usize) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some("modified".into()),
            additions: add,
            deletions: del,
            ..Default::default()
        }
    }

    fn finding(kind: FindingKind, sev: Severity) -> Finding {
        Finding {
            kind,
            severity: sev,
            effort: Effort::Medium,
            confidence: 0.9,
            line: 1,
            message: "m".into(),
            evidence: vec![],
            remediation: None,
            byte_range: None,
            fidelity: None,
            fusion_paths: vec![],
            predicted_sql: None,
            originating_orm: None,
        }
    }

    #[test]
    fn fragility_rises_with_fan_in() {
        let mut low = mk_node("leaf", "a.rs");
        low.call_site_count = 1;
        let mut hub = mk_node("hub", "a.rs");
        hub.call_site_count = 80;
        assert!(fragility_node(&hub, 0) > fragility_node(&low, 0));
    }

    #[test]
    fn findings_lower_longevity() {
        let files = vec![cf("a.rs", 30, 0)];
        let clean = compute(Inputs {
            entries: &[mk_node("f", "a.rs")],
            changed_files: &files,
            commit_messages: &[],
            signals: &PrSignals::default(),
            repo_root: None,
            total_symbols: 0,
        });
        let node = with_findings(mk_node("f", "a.rs"), vec![finding(FindingKind::NPlusOne, Severity::High)]);
        let sig = collect(&[node.clone()], &["a.rs".into()], &QualityBar::default());
        let debty = compute(Inputs {
            entries: &[node],
            changed_files: &files,
            commit_messages: &[],
            signals: &sig,
            repo_root: None,
            total_symbols: 0,
        });
        assert!(debty.score < clean.score, "findings should lower longevity: clean={} debt={}", clean.score, debty.score);
    }

    #[test]
    fn fix_and_refactor_commits_reduce_net_debt() {
        let files = vec![cf("a.rs", 20, 60)]; // net deletion → cleanup credit
        let node = with_findings(mk_node("f", "a.rs"), vec![finding(FindingKind::NPlusOne, Severity::High)]);
        let sig = collect(&[node.clone()], &["a.rs".into()], &QualityBar::default());
        let no_fix = compute(Inputs {
            entries: &[node.clone()],
            changed_files: &files,
            commit_messages: &["feat: x".into()],
            signals: &sig,
            repo_root: None,
            total_symbols: 0,
        });
        let with_fix = compute(Inputs {
            entries: &[node],
            changed_files: &files,
            commit_messages: &["fix: bug".into(), "refactor: tidy".into()],
            signals: &sig,
            repo_root: None,
            total_symbols: 0,
        });
        // more paydown → lower net debt → higher longevity (or equal if clamped)
        assert!(with_fix.score >= no_fix.score);
        let net_no = match no_fix.inputs.get("net_debt_hours").unwrap() { InputValue::Number(n) => *n, _ => panic!() };
        let net_yes = match with_fix.inputs.get("net_debt_hours").unwrap() { InputValue::Number(n) => *n, _ => panic!() };
        assert!(net_yes < net_no, "fix+refactor must reduce net debt: {net_no} vs {net_yes}");
    }

    #[test]
    fn finite_and_bounded_on_empty() {
        let r = compute(Inputs {
            entries: &[],
            changed_files: &[],
            commit_messages: &[],
            signals: &PrSignals::default(),
            repo_root: None,
            total_symbols: 0,
        });
        assert!(r.score.is_finite() && (0.0..=1.0).contains(&r.score));
        // empty PR → no debt → ages perfectly well
        assert!(r.score > 0.9);
    }
}
