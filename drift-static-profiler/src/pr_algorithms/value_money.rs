//! §3.4 — Money axis of the Value Card.
//!
//! ## What this axis measures (reworked)
//!
//! NOT the cost to *write* a feature (new-feature dev-hours are
//! intentionally no longer modeled). Instead it measures the cost of
//! **servicing the technical debt the PR ships** — the money that leaves
//! the org *after* merge:
//!
//! ```text
//! cost_usd = human_debt_usd + llm_iteration_cost_usd + infra_cost_usd
//!   human_debt_usd        = (bug_hours + maintenance_hours) × DEV_HOUR_USD
//!     bug_hours           = Σ findings · bug_hours(tier)   [Critical 8 / Important 3 / Minor 0.5]
//!     maintenance_hours   = findings · MAINT_HOURS_PER_FINDING + LOC_added · MAINT_HOURS_PER_LOC
//!   llm_iteration_cost    = EXPECTED_ITERATIONS · TOKENS_PER_ITERATION · size_factor
//!                            · debt_multiplier · ($/1M tokens)        ← AI-token cost of iterating
//!   infra_cost_usd        = (touches_infra || touches_db) ? m5 × 730h : 0
//!
//! savings_usd = bug_fix_savings + cleanup_savings + perf_savings   (debt paid down)
//!   bug_fix_savings = fix_commits · bug_hours(Important) · DEV_HOUR_USD
//!   cleanup_savings = max(0, LOC_del − LOC_add) · MAINT_HOURS_PER_LOC · DEV_HOUR_USD
//!   perf_savings    = (perf: && not contradicted) ? m5 × 730h × 12 : 0
//!
//! delta% = (savings_usd − cost_usd) / (160h × DEV_HOUR_USD) × 100
//! ```
//!
//! Every constant is research-cited in `pr_algorithms_constants.json`
//! (`tech_debt_economics`). The LLM-token term is first-class: complex/buggy
//! code costs an AI agent more tokens to iterate on (bigger context + more
//! retries), so it raises the projected cost.

use crate::pr_algorithms::constants::{
    aws_ec2_citation, aws_ec2_m5_large_usd_per_hour, aws_hours_per_month, bug_hours_critical,
    bug_hours_important, bug_hours_minor, dev_hour_usd, llm_blended_usd_per_mtoken,
    llm_expected_iterations, llm_tokens_per_iteration, maint_hours_per_finding, maint_hours_per_loc,
    tech_debt_economics_citation,
};
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::pr_signals::{PrSignals, SignalTier};
use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

const INFRA_HINTS: &[&str] = &[
    "infrastructure/",
    "infra/",
    ".tf",
    "terraform",
    "helm/",
    "k8s/",
    "kubernetes/",
    "kustomize",
    "dockerfile",
    "docker-compose",
];

fn touches_infrastructure(files: &[ChangedFile]) -> bool {
    files.iter().any(|f| {
        let p = f.path.to_lowercase();
        INFRA_HINTS.iter().any(|h| p.contains(h))
    })
}

fn first_word_is(messages: &[String], prefix: &str) -> usize {
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

/// Bug-servicing hours for a finding, by review tier. A Critical latent
/// defect that ships costs the most to service (defect-cost escalation).
fn bug_hours_for(tier: SignalTier) -> f64 {
    match tier {
        SignalTier::Critical => bug_hours_critical(),
        SignalTier::Important => bug_hours_important(),
        SignalTier::Minor => bug_hours_minor(),
    }
}

/// A `perf:` claim is "contradicted" when the changed code carries a
/// Critical runtime-degrading finding — the projected savings are illusory,
/// so they're not booked.
fn perf_claim_contradicted(signals: &PrSignals) -> bool {
    signals
        .findings
        .iter()
        .any(|f| f.tier == SignalTier::Critical && f.is_runtime_degrading())
}

fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

pub fn compute(
    changed_files: &[ChangedFile],
    commit_messages: &[String],
    // PR-scoped findings: the latent defects + debt this PR ships drive the
    // bug/maintenance/LLM-iteration cost; a Critical runtime finding voids a
    // `perf:` savings claim.
    signals: &PrSignals,
) -> ValueAxis {
    let added: usize = changed_files.iter().map(|f| f.additions).sum();
    let deleted: usize = changed_files.iter().map(|f| f.deletions).sum();
    let n_files = changed_files.len();
    let findings_n = signals.findings.len() as f64;

    let rate = dev_hour_usd();
    let aws_m5 = aws_ec2_m5_large_usd_per_hour();
    let aws_hpm = aws_hours_per_month();

    // ── COST: technical-debt servicing this PR adds ──────────────────────
    // 1. Latent-defect (bug) servicing hours, by finding tier.
    let bug_hours: f64 = signals.findings.iter().map(|f| bug_hours_for(f.tier)).sum();
    // 2. Ongoing maintenance: per-finding iteration drag + per-LOC tax.
    let maintenance_hours = findings_n * maint_hours_per_finding() + added as f64 * maint_hours_per_loc();
    let tech_debt_hours = bug_hours + maintenance_hours;
    let human_debt_usd = tech_debt_hours * rate;

    // 3. LLM iteration cost — the money an AI agent spends re-reading and
    //    retrying on this code over its maintenance life. Scales with the
    //    change surface (more files → bigger context) and with detected debt
    //    (messier code → more self-correction retries).
    let size_factor = if n_files == 0 {
        0.0
    } else {
        1.0 + (n_files - 1) as f64 * 0.3
    };
    let debt_multiplier = (1.0 + 0.4 * findings_n.min(5.0)).min(3.0);
    let llm_tokens = llm_expected_iterations() * llm_tokens_per_iteration() * size_factor * debt_multiplier;
    let llm_iteration_cost_usd = llm_tokens * llm_blended_usd_per_mtoken() / 1_000_000.0;

    // 4. Infra/DB operational cost — a new query path / IaC change is a new
    //    thing to run and pay for monthly.
    let infra = touches_infrastructure(changed_files);
    let infra_or_db = infra || signals.touches_db;
    let infra_cost_usd = if infra_or_db { aws_m5 * aws_hpm } else { 0.0 };

    let cost_usd = human_debt_usd + llm_iteration_cost_usd + infra_cost_usd;

    // ── SAVINGS: debt this PR pays down ──────────────────────────────────
    let fix_commits = first_word_is(commit_messages, "fix:");
    let bug_fix_savings = fix_commits as f64 * bug_hours_important() * rate;
    let cleanup_savings = deleted.saturating_sub(added) as f64 * maint_hours_per_loc() * rate;
    let contradicted = perf_claim_contradicted(signals);
    let perf_savings = if first_word_is(commit_messages, "perf:") > 0 && !contradicted {
        aws_m5 * aws_hpm * 12.0
    } else {
        0.0
    };
    let savings_usd = bug_fix_savings + cleanup_savings + perf_savings;

    // ── delta ────────────────────────────────────────────────────────────
    let baseline_usd = 160.0 * rate; // one engineer-month, the normalizer.
    let delta_raw = if baseline_usd > 0.0 {
        (savings_usd - cost_usd) / baseline_usd * 100.0
    } else {
        0.0
    };
    // serde_json rejects NaN/inf; an astronomical LOC count must not poison
    // the output.
    let delta = if delta_raw.is_finite() { delta_raw } else { 0.0 };

    let mut confidence = if added + deleted > 1000 {
        Confidence::Low
    } else if n_files <= 3 && findings_n == 0.0 && added < 100 {
        Confidence::High
    } else {
        Confidence::Medium
    };
    if contradicted {
        confidence = Confidence::Low;
    }
    let direction = if delta >= 0.0 { Direction::Up } else { Direction::Down };

    // ── scan attribute: the full breakdown, machine-readable ─────────────
    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("loc_added".into(), InputValue::Number(added as f64));
    inputs.insert("loc_deleted".into(), InputValue::Number(deleted as f64));
    inputs.insert("files_touched".into(), InputValue::Number(n_files as f64));
    inputs.insert("findings_introduced".into(), InputValue::Number(findings_n));
    inputs.insert("bug_fix_hours".into(), InputValue::Number(round2(bug_hours)));
    inputs.insert("maintenance_hours".into(), InputValue::Number(round2(maintenance_hours)));
    inputs.insert("tech_debt_hours".into(), InputValue::Number(round2(tech_debt_hours)));
    inputs.insert("human_debt_usd".into(), InputValue::Number(round2(human_debt_usd)));
    inputs.insert("llm_iteration_tokens".into(), InputValue::Number(llm_tokens.round()));
    inputs.insert("llm_iteration_cost_usd".into(), InputValue::Number(round2(llm_iteration_cost_usd)));
    inputs.insert("infra_cost_usd_monthly".into(), InputValue::Number(round2(infra_cost_usd)));
    // Back-compat alias for older renderers that read the old key.
    inputs.insert("aws_cost_usd_monthly".into(), InputValue::Number(round2(infra_cost_usd)));
    inputs.insert("cost_usd_total".into(), InputValue::Number(round2(cost_usd)));
    inputs.insert("bug_fix_savings_usd".into(), InputValue::Number(round2(bug_fix_savings)));
    inputs.insert("cleanup_savings_usd".into(), InputValue::Number(round2(cleanup_savings)));
    inputs.insert("perf_savings_usd_annual".into(), InputValue::Number(round2(perf_savings)));
    inputs.insert("projected_savings_usd".into(), InputValue::Number(round2(savings_usd)));
    inputs.insert("dev_hour_rate_usd".into(), InputValue::Number(rate));
    inputs.insert("baseline_monthly_dev_cost_usd".into(), InputValue::Number(round2(baseline_usd)));
    inputs.insert("touches_infrastructure".into(), InputValue::Bool(infra));
    inputs.insert("touches_db".into(), InputValue::Bool(signals.touches_db));
    inputs.insert("perf_claim_contradicted".into(), InputValue::Bool(contradicted));

    // ── PR comment: the breakdown reviewers see in the sticky comment ────
    let mut kv = vec![ValueKv {
        label: "Tech-debt invested".into(),
        value: format!("-${:.0}", cost_usd),
        kind: KvKind::Cost,
    }];
    if bug_hours > 0.0 {
        kv.push(ValueKv {
            label: "↳ Bug-fix debt".into(),
            value: format!("-${:.0} ({:.0}h)", bug_hours * rate, bug_hours),
            kind: KvKind::Cost,
        });
    }
    if maintenance_hours > 0.0 {
        kv.push(ValueKv {
            label: "↳ Maintenance debt".into(),
            value: format!("-${:.0} ({:.1}h)", maintenance_hours * rate, maintenance_hours),
            kind: KvKind::Cost,
        });
    }
    if llm_iteration_cost_usd > 0.0 {
        kv.push(ValueKv {
            label: "↳ LLM iteration cost".into(),
            value: format!("-${:.0} (~{:.1}M tokens)", llm_iteration_cost_usd, llm_tokens / 1_000_000.0),
            kind: KvKind::Cost,
        });
    }
    if infra_cost_usd > 0.0 {
        kv.push(ValueKv {
            label: "↳ Infra / DB monthly".into(),
            value: format!("-${:.0}", infra_cost_usd),
            kind: KvKind::Cost,
        });
    }
    kv.push(ValueKv {
        label: "Projected savings".into(),
        value: format!("+${:.0}", savings_usd),
        kind: if savings_usd > 0.0 { KvKind::Profit } else { KvKind::Muted },
    });
    if contradicted {
        kv.push(ValueKv {
            label: "⚠ perf: claim voided".into(),
            value: "Critical runtime finding — savings unproven".into(),
            kind: KvKind::Muted,
        });
    }

    ValueAxis {
        name: "money".into(),
        label: "💰 Money".into(),
        subtitle: "Tech-debt servicing: bugs + maintenance + AI tokens".into(),
        delta_percent: (delta * 10.0).round() / 10.0,
        direction,
        confidence,
        formula: "Δ% = (projected_savings − cost) / (160h × $95) × 100. cost = \
                  human_debt (bug_hours[Critical 8 / Important 3 / Minor 0.5] + maintenance \
                  [1.5h/finding + 0.01h/LOC]) × $95 + LLM_iteration_cost (6 iters × ~1M tokens \
                  × size × debt-multiplier × $5/1M) + infra/db uplift. NEW-feature dev-time is \
                  NOT modeled — this axis is the cost of SERVICING what the PR ships."
            .into(),
        inputs,
        kv,
        source: "Tech-debt servicing model — bug-fix hours (defect-cost escalation, \
                 testomat/cloudqa 2025-26), maintenance (Sonar: ~5,500 dev-h/yr per 1M LOC), \
                 and LLM iteration tokens (agentic ~1M tok/iteration, blended ~$5/1M — BenchLM / \
                 Stanford Digital Economy Lab 2026). dev-rate: HiBob fully-burdened US $95/hr."
            .into(),
        source_link: tech_debt_economics_citation().to_string(),
        additional_sources: crate::pr_algorithms::constants::axis_sources("money"),
    }
}

/// Public accessor for the AWS-pricing citation (the infra reference rate).
#[allow(dead_code)]
pub fn aws_citation_url() -> &'static str {
    aws_ec2_citation()
}

/// Public accessor for the tech-debt-economics citation (the primary driver
/// of the cost side now).
#[allow(dead_code)]
pub fn primary_citation_url() -> &'static str {
    tech_debt_economics_citation()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn f(path: &str, add: usize, del: usize, status: &str) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some(status.into()),
            additions: add,
            deletions: del,
            ..Default::default()
        }
    }

    fn num(axis: &ValueAxis, key: &str) -> f64 {
        match axis.inputs.get(key).unwrap_or_else(|| panic!("missing input {key}")) {
            InputValue::Number(n) => *n,
            _ => panic!("input {key} is not a number"),
        }
    }

    /// Build a PR-signals view holding one finding in changed code.
    fn signals_with(kind: crate::insights::FindingKind, sev: crate::insights::Severity, conf: f64) -> PrSignals {
        use crate::insights::{Effort, Finding};
        use crate::pr_algorithms::pr_signals::{collect, QualityBar};
        use crate::pr_algorithms::test_helpers::{mk_node, with_findings};
        let node = with_findings(
            mk_node("hot", "svc/hot.rs"),
            vec![Finding {
                kind,
                severity: sev,
                effort: Effort::Medium,
                confidence: conf,
                line: 9,
                message: "m".into(),
                evidence: vec![],
                remediation: None,
                byte_range: None,
                fidelity: None,
                fusion_paths: vec![],
                predicted_sql: None,
                originating_orm: None,
            }],
        );
        collect(&[node], &["svc/hot.rs".to_string()], &QualityBar::default())
    }

    #[test]
    fn empty_pr_is_neutral() {
        let r = compute(&[], &[], &PrSignals::default());
        assert_eq!(r.name, "money");
        assert!((r.delta_percent - 0.0).abs() < 0.01, "empty PR → ~0, got {}", r.delta_percent);
    }

    #[test]
    fn small_code_pr_is_negative_money() {
        // No findings, no fix/perf commits → pure servicing cost, no savings.
        let files = vec![f("app/a.py", 30, 5, "modified"), f("app/b.py", 20, 0, "modified")];
        let commits = vec!["feat: add a thing".into()];
        let r = compute(&files, &commits, &PrSignals::default());
        assert!(r.delta_percent < 0.0, "expected negative, got {}", r.delta_percent);
        assert!((num(&r, "loc_added") - 50.0).abs() < 0.01);
    }

    /// The crucial new term: every non-empty PR carries an LLM iteration cost
    /// (>0 tokens and >0 USD).
    #[test]
    fn llm_iteration_cost_is_first_class() {
        let files = vec![f("svc/a.py", 10, 0, "modified")];
        let r = compute(&files, &[], &PrSignals::default());
        assert!(num(&r, "llm_iteration_tokens") > 0.0, "expected >0 tokens");
        assert!(num(&r, "llm_iteration_cost_usd") > 0.0, "expected >0 USD LLM cost");
    }

    #[test]
    fn perf_commit_yields_projected_savings() {
        let files = vec![f("svc/hot.py", 20, 5, "modified")];
        let commits = vec!["perf: cache the inner loop".into()];
        let r = compute(&files, &commits, &PrSignals::default());
        assert!(num(&r, "perf_savings_usd_annual") > 0.0);
    }

    #[test]
    fn touching_infra_adds_infra_cost() {
        let files = vec![f("infrastructure/eks/main.tf", 10, 0, "modified")];
        let r = compute(&files, &[], &PrSignals::default());
        match r.inputs.get("touches_infrastructure").unwrap() {
            InputValue::Bool(b) => assert!(*b),
            _ => panic!("expected bool"),
        }
        assert!(num(&r, "infra_cost_usd_monthly") > 0.0);
    }

    #[test]
    fn huge_pr_lowers_confidence() {
        let files = vec![f("a.py", 1500, 200, "modified")];
        let r = compute(&files, &[], &PrSignals::default());
        assert_eq!(r.confidence, Confidence::Low);
    }

    /// JSON integrity: delta_percent MUST always be finite even for an
    /// astronomical LOC count.
    #[test]
    fn extreme_loc_does_not_produce_nan() {
        let files = vec![f("huge.py", usize::MAX / 8, 0, "modified")];
        let r = compute(&files, &[], &PrSignals::default());
        assert!(r.delta_percent.is_finite(), "delta must be finite, got {}", r.delta_percent);
    }

    #[test]
    fn source_link_populated_from_constants() {
        let r = compute(&[], &[], &PrSignals::default());
        assert!(r.source_link.starts_with("https://"), "source_link must be HTTPS, got {:?}", r.source_link);
    }

    /// Findings add bug + maintenance debt, so the SAME diff scores
    /// strictly more-negative money than a clean one, and tech_debt_hours > 0.
    #[test]
    fn findings_add_tech_debt_cost() {
        let files = vec![f("svc/hot.rs", 20, 0, "modified")];
        let clean = compute(&files, &[], &PrSignals::default());
        let with_debt = compute(
            &files,
            &[],
            &signals_with(crate::insights::FindingKind::NPlusOne, crate::insights::Severity::High, 0.9),
        );
        assert!(
            with_debt.delta_percent < clean.delta_percent,
            "debt should lower money: clean={} debt={}",
            clean.delta_percent,
            with_debt.delta_percent
        );
        assert!(num(&with_debt, "bug_fix_hours") > 0.0);
        assert!(num(&with_debt, "tech_debt_hours") > 0.0);
    }

    /// A `perf:` claim contradicted by a Critical runtime finding books no
    /// projected savings.
    #[test]
    fn perf_savings_voided_when_contradicted() {
        let files = vec![f("svc/hot.rs", 20, 5, "modified")];
        let commits = vec!["perf: cache it".into()];
        let sig = signals_with(crate::insights::FindingKind::NPlusOne, crate::insights::Severity::High, 0.9);
        let r = compute(&files, &commits, &sig);
        assert!((num(&r, "perf_savings_usd_annual")).abs() < 1e-9, "perf savings must be voided");
        assert!(r.kv.iter().any(|k| k.label.contains("voided")));
    }
}
