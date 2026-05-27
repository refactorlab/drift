//! §3.5 — Customer value axis: weighted features + issues_resolved,
//! dampened when the PR ships a Critical correctness/security finding (a
//! feature delivered with a serious bug is worth less to the user).

use crate::pr_algorithms::pr_signals::{PrSignals, SignalTier};
use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

pub fn compute(counts: &PrCounts, signals: &PrSignals) -> ValueAxis {
    let feat = counts.features.value as f64;
    let issues = counts.issues_resolved.value as f64;
    let fixes = counts.bug_fixes.value as f64;

    let feat_pct = (feat / 3.0).min(1.0) * 100.0;
    let issues_pct = ((issues + fixes) / 3.0).min(1.0) * 100.0;
    // Base weighted score. Round to one decimal: `(x * 10).round() / 10`.
    // (Parens were once wrong here — see the regression test pinning
    // feat=1, fixes=2 → ~46.7%.)
    let base = 0.6 * feat_pct + 0.4 * issues_pct;
    // Dampen by detected Critical findings: a shipped feature carrying a
    // serious correctness/security defect delivers less realized value.
    // 0 findings → ×1.0 (unchanged); capped at 3 → ×0.55.
    let critical = signals.count_at_least(SignalTier::Critical);
    let dampening = 1.0 - 0.15 * (critical.min(3) as f64);
    let delta = (base * dampening * 10.0).round() / 10.0;

    let total = counts.features.value + counts.issues_resolved.value + counts.bug_fixes.value;
    let mut confidence = if total == 0 {
        Confidence::Low
    } else if total >= 4 {
        Confidence::High
    } else {
        Confidence::Medium
    };
    // A critical finding undercuts our confidence in the realized value.
    if critical > 0 {
        confidence = match confidence {
            Confidence::High => Confidence::Medium,
            _ => Confidence::Low,
        };
    }

    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("features_count".into(), InputValue::Number(feat));
    inputs.insert("issues_resolved_count".into(), InputValue::Number(issues));
    inputs.insert("bug_fixes_count".into(), InputValue::Number(fixes));
    inputs.insert(
        "critical_findings".into(),
        InputValue::Number(critical as f64),
    );

    let mut kv = vec![
        ValueKv {
            label: "Features delivered".into(),
            value: feat.to_string(),
            kind: if feat > 0.0 { KvKind::Profit } else { KvKind::Muted },
        },
        ValueKv {
            label: "Issues resolved".into(),
            value: issues.to_string(),
            kind: if issues > 0.0 { KvKind::Profit } else { KvKind::Muted },
        },
        ValueKv {
            label: "Bugs fixed".into(),
            value: fixes.to_string(),
            kind: if fixes > 0.0 { KvKind::Profit } else { KvKind::Muted },
        },
    ];
    if critical > 0 {
        kv.push(ValueKv {
            label: "⚠ Ships with critical finding".into(),
            value: format!("{critical} critical — value dampened {:.0}%", (1.0 - dampening) * 100.0),
            kind: KvKind::Cost,
        });
    }

    ValueAxis {
        name: "customer".into(),
        label: "👥 Customer / user value".into(),
        subtitle: "Time saved + value added per session".into(),
        delta_percent: delta,
        direction: if delta >= 0.0 { Direction::Up } else { Direction::Down },
        confidence,
        formula: "Δ% = (0.6 × min(features/3, 1) × 100 + 0.4 × min((issues+fixes)/3, 1) × 100) \
                  × dampening, where dampening = 1 − 0.15 × min(critical_findings, 3)."
            .into(),
        inputs,
        kv,
        source: "derived from PrCounts (Conventional Commits + GitHub linking keywords)".into(),
        source_link: crate::pr_algorithms::constants::CONVENTIONAL_COMMITS_URL.to_string(),
        additional_sources: crate::pr_algorithms::constants::axis_sources("customer"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::types::{CountChip, PrCounts};

    fn chip(n: usize) -> CountChip {
        CountChip {
            value: n,
            label: "x".into(),
            detail: String::new(),
            source: String::new(),
        }
    }

    #[test]
    fn zero_inputs_low_confidence() {
        let r = compute(&PrCounts::default(), &PrSignals::default());
        assert_eq!(r.confidence, Confidence::Low);
        assert!(r.delta_percent.abs() < 0.01);
    }

    #[test]
    fn one_feature_yields_some_delta() {
        let mut c = PrCounts::default();
        c.features = chip(1);
        let r = compute(&c, &PrSignals::default());
        assert!(r.delta_percent > 0.0);
    }

    #[test]
    fn many_signals_high_confidence() {
        let mut c = PrCounts::default();
        c.features = chip(3);
        c.bug_fixes = chip(2);
        let r = compute(&c, &PrSignals::default());
        assert_eq!(r.confidence, Confidence::High);
    }

    /// Regression test for the parenthesis bug: 1 feature + 2 fixes
    /// must produce ~46.7% (matches the prior Python implementation),
    /// not the buggy 28.7% from misplaced parens.
    #[test]
    fn delta_pct_matches_python_reference_for_known_inputs() {
        let mut c = PrCounts::default();
        c.features = chip(1);
        c.bug_fixes = chip(2);
        let r = compute(&c, &PrSignals::default());
        // feat_pct = 1/3 × 100 ≈ 33.3; issues_pct = 2/3 × 100 ≈ 66.7
        // delta = 0.6×33.3 + 0.4×66.7 ≈ 46.7
        assert!(
            (r.delta_percent - 46.7).abs() < 0.5,
            "expected ~46.7%, got {}",
            r.delta_percent
        );
    }

    #[test]
    fn delta_pct_caps_at_100() {
        // Cap test: 100 features + 100 fixes can't exceed 100%.
        let mut c = PrCounts::default();
        c.features = chip(100);
        c.bug_fixes = chip(100);
        c.issues_resolved = chip(100);
        let r = compute(&c, &PrSignals::default());
        assert!(r.delta_percent <= 100.0, "uncapped output: {}", r.delta_percent);
    }

    /// A Critical finding dampens realized customer value and knocks
    /// confidence down a notch vs. the same PR with a clean scan.
    #[test]
    fn critical_finding_dampens_value() {
        use crate::insights::{Effort, Finding, FindingKind, Severity};
        use crate::pr_algorithms::pr_signals::{collect, QualityBar};
        use crate::pr_algorithms::test_helpers::{mk_node, with_findings};

        let mut c = PrCounts::default();
        c.features = chip(3);
        c.bug_fixes = chip(2); // total >= 4 → High confidence when clean

        let clean = compute(&c, &PrSignals::default());
        assert_eq!(clean.confidence, Confidence::High);

        let node = with_findings(
            mk_node("checkout", "src/checkout.rs"),
            vec![Finding {
                kind: FindingKind::AuthCryptoAntipattern, // Security → Critical at High
                severity: Severity::High,
                effort: Effort::Medium,
                confidence: 0.9,
                line: 7,
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
        let sig = collect(&[node], &["src/checkout.rs".to_string()], &QualityBar::default());
        let dampened = compute(&c, &sig);
        assert!(
            dampened.delta_percent < clean.delta_percent,
            "critical finding should dampen value: clean={} dampened={}",
            clean.delta_percent,
            dampened.delta_percent
        );
        assert_eq!(dampened.confidence, Confidence::Medium, "High knocked to Medium");
    }
}
