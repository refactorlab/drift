//! §3.7 — Runtime UX axis: new tests + docs commits + bug-fix activity,
//! cross-checked against detected risk (a risky change shipped without new
//! test coverage hurts the debugging experience).

use crate::pr_algorithms::pr_signals::{PrSignals, SignalTier};
use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

pub fn compute(counts: &PrCounts, commit_messages: &[String], signals: &PrSignals) -> ValueAxis {
    let new_tests = counts.new_test_files.value;
    let fixes = counts.bug_fixes.value;

    let doc_commits = commit_messages
        .iter()
        .filter(|m| {
            m.lines()
                .next()
                .and_then(|l| l.split(':').next())
                .map(|t| {
                    let t = t.trim().to_lowercase();
                    t == "docs" || t == "doc"
                })
                .unwrap_or(false)
        })
        .count();

    let raw = (new_tests as f64 * 5.0) + (fixes as f64 * 3.0) + (doc_commits as f64 * 4.0);
    let delta = raw.min(60.0);

    let critical_findings = signals.count_at_least(SignalTier::Critical);

    let mut confidence = if new_tests + fixes + doc_commits == 0 {
        Confidence::Low
    } else if new_tests >= 3 {
        Confidence::Medium
    } else {
        Confidence::Low
    };
    // Coverage-of-risk: a Critical finding in the changed code with NO new
    // tests means the risky path ships unverified — the debugging experience
    // is worse, so don't let docs/fix activity inflate confidence.
    if critical_findings > 0 && new_tests == 0 {
        confidence = Confidence::Low;
    }

    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("new_test_files".into(), InputValue::Number(new_tests as f64));
    inputs.insert("bug_fixes".into(), InputValue::Number(fixes as f64));
    inputs.insert("docs_commits".into(), InputValue::Number(doc_commits as f64));
    inputs.insert(
        "critical_findings".into(),
        InputValue::Number(critical_findings as f64),
    );

    let mut kv = vec![
        ValueKv {
            label: "New tests".into(),
            value: new_tests.to_string(),
            kind: if new_tests > 0 { KvKind::Profit } else { KvKind::Muted },
        },
        ValueKv {
            label: "Docs commits".into(),
            value: doc_commits.to_string(),
            kind: if doc_commits > 0 { KvKind::Profit } else { KvKind::Muted },
        },
    ];
    if critical_findings > 0 && new_tests == 0 {
        kv.push(ValueKv {
            label: "⚠ Risk shipped untested".into(),
            value: format!("{critical_findings} critical finding(s), 0 new tests"),
            kind: KvKind::Cost,
        });
    }

    ValueAxis {
        name: "runtime_ux".into(),
        label: "🎨 Software runtime UX".into(),
        subtitle: "Dev / debugging experience time delta".into(),
        delta_percent: (delta * 10.0).round() / 10.0,
        direction: if delta >= 0.0 { Direction::Up } else { Direction::Down },
        confidence,
        formula: "Δ% = min(60, 5·new_test_files + 3·bug_fixes + 4·docs_commits). Confidence \
                  held Low when a Critical finding ships with zero new tests."
            .into(),
        inputs,
        kv,
        source: "Conventional Commits docs/test signals + GitHub linking keywords".into(),
        source_link: crate::pr_algorithms::constants::CONVENTIONAL_COMMITS_URL.to_string(),
        additional_sources: crate::pr_algorithms::constants::axis_sources("runtime_ux"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::types::{CountChip, PrCounts};

    #[test]
    fn docs_commit_increases_delta() {
        let r = compute(
            &PrCounts::default(),
            &["docs: update README".into()],
            &PrSignals::default(),
        );
        assert!(r.delta_percent > 0.0);
    }

    #[test]
    fn many_new_tests_medium_confidence() {
        let c = PrCounts {
            new_test_files: CountChip {
                value: 3,
                ..Default::default()
            },
            ..Default::default()
        };
        let r = compute(&c, &[], &PrSignals::default());
        assert_eq!(r.confidence, Confidence::Medium);
    }

    /// Coverage-of-risk: a Critical finding with no new tests holds the
    /// axis confidence at Low even when docs/fix activity is present.
    #[test]
    fn critical_finding_without_tests_holds_confidence_low() {
        use crate::insights::{Effort, Finding, FindingKind, Severity};
        use crate::pr_algorithms::pr_signals::{collect, QualityBar};
        use crate::pr_algorithms::test_helpers::{mk_node, with_findings};

        let node = with_findings(
            mk_node("risky", "src/risky.rs"),
            vec![Finding {
                kind: FindingKind::NPlusOne,
                severity: Severity::High,
                effort: Effort::Medium,
                confidence: 0.9,
                line: 3,
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
        let sig = collect(&[node], &["src/risky.rs".to_string()], &QualityBar::default());
        // docs commit would otherwise contribute, but no new tests + a
        // critical finding → confidence stays Low.
        let r = compute(&PrCounts::default(), &["docs: note".into()], &sig);
        assert_eq!(r.confidence, Confidence::Low);
        assert!(r.kv.iter().any(|k| k.label.contains("Risk shipped untested")));
    }
}
