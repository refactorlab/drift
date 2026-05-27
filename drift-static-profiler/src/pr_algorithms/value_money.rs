//! §3.4 — Money axis of the Value Card.
//!
//! Formula (every input is research-cited in [`crate::pr_algorithms::constants`]):
//!
//! ```text
//! dev_hours    = LOC_added × HOURS_PER_LOC_ADDED + files × HOURS_PER_FILE_TOUCHED
//! dev_cost     = dev_hours × DEV_HOUR_USD
//! aws_cost     = touches_infra ? AWS_EC2_M5_LARGE × 730h : 0
//! cleanup_pft  = max(0, LOC_del - LOC_add) × HOURS_PER_LOC_ADDED × 0.3 × DEV_HOUR_USD
//! perf_pft     = has_perf_commits ? AWS_EC2_M5_LARGE × 730h × 12 : 0
//! delta_pct    = (profit − cost) / (160h × DEV_HOUR_USD) × 100
//! ```

use crate::insights::{FindingCategory, FindingKind};
use crate::pr_algorithms::constants::{
    aws_ec2_citation, aws_ec2_m5_large_usd_per_hour, aws_hours_per_month, dev_hour_citation,
    dev_hour_usd, hours_per_file_touched, hours_per_loc_added,
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

fn has_perf_commits(messages: &[String]) -> bool {
    messages.iter().any(|m| {
        m.lines()
            .next()
            .map(|l| l.to_lowercase().starts_with("perf:"))
            .unwrap_or(false)
    })
}

/// Rough remediation-time estimate (hours) for the debt one finding adds.
/// Coarse on purpose — the point is that Critical debt costs more to repay
/// than Minor debt, not a precise minute count.
fn remediation_hours(tier: SignalTier) -> f64 {
    match tier {
        SignalTier::Critical => 4.0,
        SignalTier::Important => 2.0,
        SignalTier::Minor => 0.5,
    }
}

/// A `perf:` claim is "contradicted" when the changed code carries a
/// Critical runtime-degrading finding — the projected savings are illusory,
/// so we must not book them as profit.
fn perf_claim_contradicted(signals: &PrSignals) -> bool {
    signals.findings.iter().any(|f| {
        f.tier == SignalTier::Critical
            && (matches!(
                f.category,
                FindingCategory::Performance | FindingCategory::Orm | FindingCategory::Sql
            ) || f.kind == FindingKind::BlockingInAsync)
    })
}

pub fn compute(
    changed_files: &[ChangedFile],
    commit_messages: &[String],
    // The PR-scoped findings: their remediation cost is debt this PR adds,
    // and a Critical runtime finding voids a `perf:` profit claim.
    signals: &PrSignals,
) -> ValueAxis {
    let added: usize = changed_files.iter().map(|f| f.additions).sum();
    let deleted: usize = changed_files.iter().map(|f| f.deletions).sum();
    let n_files = changed_files.len();

    let dev_hour_rate = dev_hour_usd();
    let aws_m5 = aws_ec2_m5_large_usd_per_hour();
    let aws_hpm = aws_hours_per_month();
    let h_per_loc = hours_per_loc_added();
    let h_per_file = hours_per_file_touched();

    let dev_hours = added as f64 * h_per_loc + n_files as f64 * h_per_file;
    let dev_cost_usd = dev_hours * dev_hour_rate;

    // DB-touching changes carry operational/infra cost the same way IaC
    // changes do — a new query path is a new thing to run and pay for.
    let infra = touches_infrastructure(changed_files);
    let infra_or_db = infra || signals.touches_db;
    let aws_cost_usd = if infra_or_db { aws_m5 * aws_hpm } else { 0.0 };

    // Debt the PR introduces: the cost of eventually fixing every finding
    // it adds in the changed code. This is what makes a "small" PR that
    // ships three N+1s cost more than its LOC suggests.
    let remediation_hours_total: f64 =
        signals.findings.iter().map(|f| remediation_hours(f.tier)).sum();
    let remediation_cost_usd = remediation_hours_total * dev_hour_rate;

    let cleanup_hours = deleted.saturating_sub(added) as f64 * h_per_loc * 0.3;
    let cleanup_profit_usd = cleanup_hours * dev_hour_rate;
    let contradicted = perf_claim_contradicted(signals);
    let perf_profit_usd = if has_perf_commits(commit_messages) && !contradicted {
        aws_m5 * aws_hpm * 12.0
    } else {
        // A perf claim contradicted by a Critical runtime finding books no
        // savings — the projected win is unproven (likely wrong).
        0.0
    };

    let cost_usd = dev_cost_usd + aws_cost_usd + remediation_cost_usd;
    let profit_usd = cleanup_profit_usd + perf_profit_usd;
    let baseline_usd = 160.0 * dev_hour_rate;
    // Baseline guard: DEV_HOUR_USD is a compile-time constant so this
    // can't realistically be zero, but guard anyway so a future
    // env-driven override can't crash with div-by-zero / NaN.
    let delta_raw = if baseline_usd > 0.0 {
        (profit_usd - cost_usd) / baseline_usd * 100.0
    } else {
        0.0
    };
    // Finite-check: cost_usd or profit_usd could blow up to ±inf if
    // upstream code somehow produces an astronomical loc count.
    // serde-json can't serialize NaN / inf, so clamp to 0 here.
    let delta = if delta_raw.is_finite() { delta_raw } else { 0.0 };

    let confidence = if added + deleted > 1000 {
        Confidence::Low
    } else if n_files <= 3 && added < 100 {
        Confidence::High
    } else {
        Confidence::Medium
    };
    let direction = if delta >= 0.0 { Direction::Up } else { Direction::Down };

    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("loc_added".into(), InputValue::Number(added as f64));
    inputs.insert("loc_deleted".into(), InputValue::Number(deleted as f64));
    inputs.insert("files_touched".into(), InputValue::Number(n_files as f64));
    inputs.insert(
        "dev_hours_estimate".into(),
        InputValue::Number((dev_hours * 100.0).round() / 100.0),
    );
    inputs.insert(
        "dev_cost_usd".into(),
        InputValue::Number((dev_cost_usd * 100.0).round() / 100.0),
    );
    inputs.insert(
        "aws_cost_usd_monthly".into(),
        InputValue::Number((aws_cost_usd * 100.0).round() / 100.0),
    );
    inputs.insert(
        "cleanup_profit_usd".into(),
        InputValue::Number((cleanup_profit_usd * 100.0).round() / 100.0),
    );
    inputs.insert(
        "perf_profit_usd_annual".into(),
        InputValue::Number((perf_profit_usd * 100.0).round() / 100.0),
    );
    inputs.insert("dev_hour_rate_usd".into(), InputValue::Number(dev_hour_rate));
    inputs.insert(
        "baseline_monthly_dev_cost_usd".into(),
        InputValue::Number((baseline_usd * 100.0).round() / 100.0),
    );
    inputs.insert(
        "touches_infrastructure".into(),
        InputValue::Bool(infra),
    );
    inputs.insert("touches_db".into(), InputValue::Bool(signals.touches_db));
    inputs.insert(
        "findings_introduced".into(),
        InputValue::Number(signals.findings.len() as f64),
    );
    inputs.insert(
        "remediation_cost_usd".into(),
        InputValue::Number((remediation_cost_usd * 100.0).round() / 100.0),
    );
    inputs.insert(
        "perf_claim_contradicted".into(),
        InputValue::Bool(contradicted),
    );

    let mut kv = vec![
        ValueKv {
            label: "Potential cost".into(),
            value: format!("-${:.0}", cost_usd),
            kind: KvKind::Cost,
        },
        ValueKv {
            label: "Potential profit".into(),
            value: format!("+${:.0}", profit_usd),
            kind: if profit_usd > 0.0 {
                KvKind::Profit
            } else {
                KvKind::Muted
            },
        },
    ];
    if remediation_cost_usd > 0.0 {
        kv.push(ValueKv {
            label: "Debt remediation".into(),
            value: format!(
                "-${:.0} ({} finding(s))",
                remediation_cost_usd,
                signals.findings.len()
            ),
            kind: KvKind::Cost,
        });
    }
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
        subtitle: "Net infra + dev-time delta".into(),
        delta_percent: (delta * 10.0).round() / 10.0,
        direction,
        confidence,
        formula: "Δ% = (profit_usd − cost_usd) / baseline_monthly_dev_cost × 100. \
                  cost_usd = dev_time + infra/db_uplift + remediation_cost (Σ finding debt \
                  by tier: Critical 4h / Important 2h / Minor 0.5h); profit_usd = \
                  cleanup_savings + perf_savings (perf voided when a Critical runtime \
                  finding contradicts the `perf:` claim)."
            .into(),
        inputs,
        kv,
        source: "dev-rate: HiBob fully-burdened US 2026 ($95/hr). AWS reference: m5.large \
                 on-demand $0.096/hr us-east-1. LOC→hour heuristic: in-house 2026 baseline."
            .into(),
        // Primary citation = the dev-rate (the biggest driver of the
        // cost side). AWS citation lives in `inputs.aws_cost_usd_monthly`
        // documentation via the `pr_algorithms_constants.json` file.
        source_link: dev_hour_citation().to_string(),
        // Authoritative reference list — AWS pricing, CNCF OpenCost,
        // BLS wages — sourced from
        // `pr_algorithms_constants.json::axis_sources.money`.
        additional_sources: crate::pr_algorithms::constants::axis_sources("money"),
    }
}

/// Public accessor so external test/inspection code can confirm the
/// primary citation URL the money axis references. Forwards to
/// `constants::dev_hour_citation()`.
#[allow(dead_code)]
pub fn primary_citation_url() -> &'static str {
    dev_hour_citation()
}

/// Public accessor for the AWS-pricing citation (the secondary
/// citation tied to the AWS reference rate when infra is touched).
#[allow(dead_code)]
pub fn aws_citation_url() -> &'static str {
    aws_ec2_citation()
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
        }
    }

    #[test]
    fn empty_pr_is_neutral() {
        let r = compute(&[], &[], &PrSignals::default());
        assert_eq!(r.name, "money");
        assert!((r.delta_percent - 0.0).abs() < 0.01);
    }

    #[test]
    fn small_code_pr_is_negative_money() {
        let files = vec![
            f("app/a.py", 30, 5, "modified"),
            f("app/b.py", 20, 0, "modified"),
        ];
        let commits = vec!["feat: add a thing".into()];
        let r = compute(&files, &commits, &PrSignals::default());
        assert!(r.delta_percent < 0.0, "expected negative, got {}", r.delta_percent);
        let added = r.inputs.get("loc_added").unwrap();
        match added {
            InputValue::Number(n) => assert!((n - 50.0).abs() < 0.01),
            _ => panic!("expected number"),
        }
    }

    #[test]
    fn perf_commit_yields_positive_profit() {
        let files = vec![f("svc/hot.py", 20, 5, "modified")];
        let commits = vec!["perf: cache the inner loop".into()];
        let r = compute(&files, &commits, &PrSignals::default());
        let v = r.inputs.get("perf_profit_usd_annual").unwrap();
        if let InputValue::Number(n) = v {
            assert!(*n > 0.0);
        } else {
            panic!("expected number");
        }
    }

    #[test]
    fn touching_infra_adds_aws_cost() {
        let files = vec![f("infrastructure/eks/main.tf", 10, 0, "modified")];
        let r = compute(&files, &[], &PrSignals::default());
        let infra = r.inputs.get("touches_infrastructure").unwrap();
        match infra {
            InputValue::Bool(b) => assert!(*b),
            _ => panic!("expected bool"),
        }
        let cost = r.inputs.get("aws_cost_usd_monthly").unwrap();
        if let InputValue::Number(n) = cost {
            assert!(*n > 0.0);
        }
    }

    #[test]
    fn huge_pr_lowers_confidence() {
        let files = vec![f("a.py", 1500, 200, "modified")];
        let r = compute(&files, &[], &PrSignals::default());
        assert_eq!(r.confidence, Confidence::Low);
    }

    /// JSON integrity: delta_percent MUST always be finite.
    /// serde_json rejects NaN/inf at serialization; an astronomical
    /// LOC count (e.g. usize::MAX) must not poison the output.
    #[test]
    fn extreme_loc_does_not_produce_nan() {
        let files = vec![ChangedFile {
            path: "huge.py".into(),
            status: Some("modified".into()),
            additions: usize::MAX / 4, // big but not overflow-instant
            deletions: 0,
        }];
        let r = compute(&files, &[], &PrSignals::default());
        assert!(
            r.delta_percent.is_finite(),
            "delta_percent must be finite, got {}",
            r.delta_percent
        );
    }

    /// `source_link` MUST be a real URL (starts with https) so the
    /// downstream renderer can hyperlink the citation. The URL comes
    /// from `pr_algorithms_constants.json` via `dev_hour_citation()`.
    #[test]
    fn source_link_populated_from_constants() {
        let r = compute(&[], &[], &PrSignals::default());
        assert!(
            r.source_link.starts_with("https://"),
            "source_link must be an HTTPS URL, got {:?}",
            r.source_link
        );
    }

    fn signals_with(kind: FindingKind, sev: crate::insights::Severity, conf: f64) -> PrSignals {
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

    /// Debt the PR introduces (a finding) raises remediation cost, so the
    /// SAME diff scores strictly more-negative money than a clean one.
    #[test]
    fn findings_add_remediation_cost() {
        let files = vec![f("svc/hot.rs", 20, 0, "modified")];
        let clean = compute(&files, &[], &PrSignals::default());
        let with_debt = compute(
            &files,
            &[],
            &signals_with(FindingKind::NPlusOne, crate::insights::Severity::High, 0.9),
        );
        assert!(
            with_debt.delta_percent < clean.delta_percent,
            "debt should lower money: clean={} debt={}",
            clean.delta_percent,
            with_debt.delta_percent
        );
        match with_debt.inputs.get("remediation_cost_usd").unwrap() {
            InputValue::Number(n) => assert!(*n > 0.0),
            _ => panic!("expected number"),
        }
    }

    /// A `perf:` claim contradicted by a Critical runtime finding books no
    /// projected savings.
    #[test]
    fn perf_profit_voided_when_contradicted() {
        let files = vec![f("svc/hot.rs", 20, 5, "modified")];
        let commits = vec!["perf: cache it".into()];
        let sig = signals_with(FindingKind::NPlusOne, crate::insights::Severity::High, 0.9);
        let r = compute(&files, &commits, &sig);
        match r.inputs.get("perf_profit_usd_annual").unwrap() {
            InputValue::Number(n) => {
                assert!((*n).abs() < 1e-9, "perf profit must be voided, got {n}")
            }
            _ => panic!("expected number"),
        }
        assert!(r.kv.iter().any(|k| k.label.contains("voided")));
    }
}
