//! §3.6 — Software-runtime axis.
//!
//! Reworked to ground the runtime signal in the static findings the
//! profiler actually detected in the *changed* code, instead of trusting a
//! `perf:` commit label alone. The classic failure mode an automated review
//! must catch is a PR that *claims* a perf win but introduces a runtime
//! regression (an N+1, a blocking call in async, an O(n²) loop). Here a
//! `perf:` commit is the optimistic prior; runtime-degrading findings are a
//! penalty that can drag the axis negative and, when they contradict the
//! `perf:` claim, hold confidence at Low.

use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::pr_signals::{PrFinding, PrSignals, SignalTier};
use crate::pr_algorithms::symbol_label::humanize_symbol_token;
use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

/// Per-finding penalty (Δ% points) by review tier.
fn tier_penalty(tier: SignalTier) -> f64 {
    match tier {
        SignalTier::Critical => 12.0,
        SignalTier::Important => 6.0,
        SignalTier::Minor => 2.0,
    }
}

pub fn compute(
    commit_messages: &[String],
    changed_files: &[ChangedFile],
    // V3: when affected roots are missing retry/timeout/fallback markers
    // (NFR reliability gaps), drop runtime confidence — a perf claim without
    // failure-mode handling is brittle.
    reliability_gap_count: usize,
    // The PR-scoped findings. Runtime-degrading ones penalize the axis and,
    // when they contradict a `perf:` claim, mark it suspect.
    signals: &PrSignals,
) -> ValueAxis {
    let perf_commits = commit_messages
        .iter()
        .filter(|m| {
            m.lines()
                .next()
                .map(|l| l.to_lowercase().starts_with("perf:"))
                .unwrap_or(false)
        })
        .count();
    let added: usize = changed_files.iter().map(|f| f.additions).sum();
    let deleted: usize = changed_files.iter().map(|f| f.deletions).sum();

    // Runtime-degrading findings actually detected in the changed code.
    let regressions: Vec<&PrFinding> =
        signals.findings.iter().filter(|f| f.is_runtime_degrading()).collect();
    let critical_regressions = regressions
        .iter()
        .filter(|f| f.tier == SignalTier::Critical)
        .count();
    let penalty: f64 = regressions
        .iter()
        .map(|f| tier_penalty(f.tier))
        .sum::<f64>()
        .min(60.0);

    // Optimistic prior: a `perf:` claim or a net code-removal cleanup.
    let optimistic = if perf_commits > 0 {
        (perf_commits as f64 * 15.0).min(60.0)
    } else if deleted > added * 3 / 2 && deleted > 50 {
        5.0
    } else if added > 1000 {
        -3.0
    } else {
        0.0
    };

    let delta = (optimistic - penalty).clamp(-60.0, 60.0);
    let contradicted = perf_commits > 0 && !regressions.is_empty();

    // Confidence: hard findings make us MORE confident about the (negative)
    // runtime signal. A `perf:` claim with no contradicting finding is
    // medium; a claim contradicted by a regression is suspect (Low).
    let mut confidence = if critical_regressions >= 3 {
        Confidence::High
    } else if critical_regressions >= 1 || (perf_commits > 0 && regressions.is_empty()) {
        Confidence::Medium
    } else {
        Confidence::Low
    };
    if contradicted || reliability_gap_count > 0 {
        confidence = Confidence::Low;
    }

    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("perf_commits".into(), InputValue::Number(perf_commits as f64));
    inputs.insert("loc_added".into(), InputValue::Number(added as f64));
    inputs.insert("loc_deleted".into(), InputValue::Number(deleted as f64));
    inputs.insert(
        "runtime_regressions".into(),
        InputValue::Number(regressions.len() as f64),
    );
    inputs.insert(
        "critical_runtime_regressions".into(),
        InputValue::Number(critical_regressions as f64),
    );
    inputs.insert("regression_penalty_pct".into(), InputValue::Number(penalty));
    inputs.insert("perf_claim_contradicted".into(), InputValue::Bool(contradicted));

    let net = added as i64 - deleted as i64;
    let mut kv = vec![
        ValueKv {
            label: "perf: commits".into(),
            value: perf_commits.to_string(),
            kind: if perf_commits > 0 { KvKind::Profit } else { KvKind::Muted },
        },
        ValueKv {
            label: "Runtime findings".into(),
            value: regressions.len().to_string(),
            kind: if regressions.is_empty() { KvKind::Muted } else { KvKind::Cost },
        },
        ValueKv {
            label: "Net LOC".into(),
            value: format!("{:+}", net),
            kind: KvKind::Neutral,
        },
    ];
    if contradicted {
        // Surface the strongest contradicting finding by name so the review
        // is auditable ("perf: claim, but we found an N+1 in …").
        let worst = regressions
            .iter()
            .max_by(|a, b| {
                a.impact_score
                    .partial_cmp(&b.impact_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap();
        kv.push(ValueKv {
            label: "⚠ perf: claim contradicted".into(),
            value: format!(
                "{} in {} ({}:{})",
                worst.kind.as_str(),
                // location is already in the (basename:line) suffix — collapse a
                // synthetic function name to a bare token. See `symbol_label`.
                humanize_symbol_token(&worst.function),
                worst.file.rsplit('/').next().unwrap_or(&worst.file),
                worst.line
            ),
            kind: KvKind::Cost,
        });
    }

    ValueAxis {
        name: "runtime".into(),
        label: "⚙️ Software runtime".into(),
        subtitle: "Wire size, memory, serialization".into(),
        delta_percent: (delta * 10.0).round() / 10.0,
        direction: if delta >= 0.0 { Direction::Up } else { Direction::Down },
        confidence,
        formula: "Δ% = optimistic_prior − regression_penalty. optimistic_prior from `perf:` \
                  commit count / net-LOC cleanup; regression_penalty sums detected \
                  runtime-degrading findings (N+1, blocking-in-async, ORM/SQL, expensive \
                  compute) by tier (Critical 12 / Important 6 / Minor 2), capped at 60."
            .into(),
        inputs,
        kv,
        source: "static findings (drift call-graph analysis) + `perf:` commit proxy".into(),
        source_link: crate::pr_algorithms::constants::CONVENTIONAL_COMMITS_URL.to_string(),
        additional_sources: crate::pr_algorithms::constants::axis_sources("runtime"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::insights::{Effort, Finding, FindingKind, Severity};
    use crate::pr_algorithms::pr_signals::{collect, QualityBar};
    use crate::pr_algorithms::test_helpers::{mk_node, with_findings};

    /// Build a PR-signals view holding one finding in changed code.
    fn signals_with(kind: FindingKind, sev: Severity, conf: f64) -> PrSignals {
        let node = with_findings(
            mk_node("hot", "src/hot.rs"),
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
        collect(&[node], &["src/hot.rs".to_string()], &QualityBar::default())
    }

    #[test]
    fn no_perf_commit_is_neutral() {
        let r = compute(&["feat: x".into()], &[], 0, &PrSignals::default());
        assert!((r.delta_percent - 0.0).abs() < 0.01);
    }

    #[test]
    fn perf_commit_drives_positive_delta() {
        let r = compute(&["perf: x".into()], &[], 0, &PrSignals::default());
        assert!(r.delta_percent > 0.0);
    }

    /// The core rework: a `perf:` PR that introduces an N+1 is dampened and
    /// its confidence is held at Low (the claim is contradicted by evidence).
    #[test]
    fn perf_claim_contradicted_by_n_plus_one_is_dampened() {
        let sig = signals_with(FindingKind::NPlusOne, Severity::High, 0.9);
        let r = compute(&["perf: speed up orders".into()], &[], 0, &sig);
        // optimistic 15 − penalty 12 (Critical) = 3 → still positive but well
        // below the unchecked 15.
        assert!(r.delta_percent < 15.0, "expected dampened, got {}", r.delta_percent);
        assert_eq!(r.confidence, Confidence::Low, "contradicted claim → Low");
        assert!(
            r.kv.iter().any(|k| k.label.contains("contradicted")),
            "should surface the contradicting finding"
        );
    }

    /// A runtime regression with no `perf:` claim drives the axis negative.
    #[test]
    fn runtime_regression_without_claim_is_negative() {
        let sig = signals_with(FindingKind::NPlusOne, Severity::High, 0.9);
        let r = compute(&["refactor: tidy".into()], &[], 0, &sig);
        assert!(r.delta_percent < 0.0, "expected negative, got {}", r.delta_percent);
        assert_eq!(r.direction, Direction::Down);
    }
}
