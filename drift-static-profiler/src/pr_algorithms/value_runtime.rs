//! §3.6 — Software-runtime axis: `perf:` commit proxy + LOC sign.

use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

pub fn compute(
    commit_messages: &[String],
    changed_files: &[ChangedFile],
    // V3: when affected roots are missing retry/timeout/fallback
    // markers (NFR reliability gaps), drop runtime confidence to
    // `low` — a perf claim without failure-mode handling is brittle.
    reliability_gap_count: usize,
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

    let (delta, mut confidence) = if perf_commits > 0 {
        ((perf_commits as f64 * 15.0).min(60.0), Confidence::Medium)
    } else if deleted > added * 3 / 2 && deleted > 50 {
        (5.0, Confidence::Low)
    } else if added > 1000 {
        (-3.0, Confidence::Low)
    } else {
        (0.0, Confidence::Low)
    };

    // V3: knock confidence down one notch per reliability gap.
    // A perf signal in code missing retry/timeout/circuit-breaker
    // markers is suspect — the runtime claim is brittle.
    if reliability_gap_count > 0 {
        confidence = Confidence::Low;
    }

    let mut inputs: BTreeMap<String, InputValue> = BTreeMap::new();
    inputs.insert("perf_commits".into(), InputValue::Number(perf_commits as f64));
    inputs.insert("loc_added".into(), InputValue::Number(added as f64));
    inputs.insert("loc_deleted".into(), InputValue::Number(deleted as f64));

    let net = added as i64 - deleted as i64;
    ValueAxis {
        name: "runtime".into(),
        label: "⚙️ Software runtime".into(),
        subtitle: "Wire size, memory, serialization".into(),
        delta_percent: (delta * 10.0).round() / 10.0,
        direction: if delta >= 0.0 { Direction::Up } else { Direction::Down },
        confidence,
        formula: "Δ% derived from `perf:` commit count (Conventional Commits) and net LOC. \
                  Real benchmarks not available at static-analysis time."
            .into(),
        inputs,
        kv: vec![
            ValueKv {
                label: "perf: commits".into(),
                value: perf_commits.to_string(),
                kind: if perf_commits > 0 { KvKind::Profit } else { KvKind::Muted },
            },
            ValueKv {
                label: "Net LOC".into(),
                value: format!("{:+}", net),
                kind: KvKind::Neutral,
            },
        ],
        source: "static-only proxy — no runtime benchmark integration yet".into(),
        // The signal we use IS the `perf:` commit prefix, so the
        // canonical citation is the Conventional Commits spec.
        source_link: crate::pr_algorithms::constants::CONVENTIONAL_COMMITS_URL.to_string(),
        additional_sources: crate::pr_algorithms::constants::axis_sources("runtime"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_perf_commit_is_neutral() {
        let r = compute(&["feat: x".into()], &[], 0);
        assert!((r.delta_percent - 0.0).abs() < 0.01);
    }

    #[test]
    fn perf_commit_drives_positive_delta() {
        let r = compute(&["perf: x".into()], &[], 0);
        assert!(r.delta_percent > 0.0);
    }
}
