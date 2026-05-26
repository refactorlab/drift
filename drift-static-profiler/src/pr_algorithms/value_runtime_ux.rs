//! §3.7 — Runtime UX axis: new tests + docs commits + bug-fix activity.

use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

pub fn compute(counts: &PrCounts, commit_messages: &[String]) -> ValueAxis {
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

    let confidence = if new_tests + fixes + doc_commits == 0 {
        Confidence::Low
    } else if new_tests >= 3 {
        Confidence::Medium
    } else {
        Confidence::Low
    };

    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("new_test_files".into(), InputValue::Number(new_tests as f64));
    inputs.insert("bug_fixes".into(), InputValue::Number(fixes as f64));
    inputs.insert("docs_commits".into(), InputValue::Number(doc_commits as f64));

    ValueAxis {
        name: "runtime_ux".into(),
        label: "🎨 Software runtime UX".into(),
        subtitle: "Dev / debugging experience time delta".into(),
        delta_percent: (delta * 10.0).round() / 10.0,
        direction: if delta >= 0.0 { Direction::Up } else { Direction::Down },
        confidence,
        formula: "Δ% = min(60, 5·new_test_files + 3·bug_fixes + 4·docs_commits)".into(),
        inputs,
        kv: vec![
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
        ],
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
        let r = compute(&PrCounts::default(), &["docs: update README".into()]);
        assert!(r.delta_percent > 0.0);
    }

    #[test]
    fn many_new_tests_medium_confidence() {
        let mut c = PrCounts::default();
        c.new_test_files = CountChip {
            value: 3,
            ..Default::default()
        };
        let r = compute(&c, &[]);
        assert_eq!(r.confidence, Confidence::Medium);
    }
}
