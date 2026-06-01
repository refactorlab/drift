//! pr_quality — six research-grounded PR-quality dimensions + a unified
//! composite, attached to `pr_review_ext.pr_quality`.
//!
//! Design (PR_QUALITY_RESEARCH.md / PR_QUALITY_METRICS_PLAN.md):
//! - **Pure, deterministic** functions over the already-populated call
//!   graph (`CallTreeNode`) + the [`pr_signals`](super::pr_signals) SSOT,
//!   plus a single defensive changed-file source reader.
//! - **No per-language Rust**: comment/string delimiters live as a data
//!   table in `pr_algorithms_constants.json` (clean-architecture rule).
//! - **Every ratio routed through [`finite_or_zero`]** — serde_json
//!   rejects NaN/Inf, and one NaN would corrupt the whole sticky comment.
//! - **Heavy-tailed counts normalized with [`log1p_sat`]** (power-law
//!   aware), thresholded sizes with [`smoothstep`] (no cliff at the knee).
//!
//! Module map: shared math here; one module per metric family; the
//! [`compute`](self) orchestrator + composite land with the merge wiring.

pub mod comprehensibility;
pub mod correctness;
pub mod gauges;
pub mod llm_complexity;
pub mod longevity;
pub mod operational;
pub mod source_scan;
pub mod team_process;
pub mod tokens;

// ── shared scoring math (used across the family modules) ──────────────

/// NaN/Inf guard — serde_json rejects non-finite floats, and one NaN
/// would poison the JSON output. Mirrors `merge::finite_or_zero`;
/// centralized here so every scorer routes ratios/logs through it.
#[allow(dead_code)]
pub(crate) fn finite_or_zero(x: f64) -> f64 {
    if x.is_finite() {
        x
    } else {
        0.0
    }
}

/// Clamp to `[0,1]` and guard NaN/Inf in one step.
#[allow(dead_code)]
pub(crate) fn clamp01(x: f64) -> f64 {
    finite_or_zero(x).clamp(0.0, 1.0)
}

/// log1p saturation: maps a heavy-tailed count onto `[0,1]`, compressing
/// the long tail and expanding the dense low range. The research's chosen
/// normalizer for power-law graph-degree counts (fan-in/out, subtree);
/// stateless (works on a single-node PR), bounded, monotone. `sat` is the
/// ~p90 saturation anchor.
#[allow(dead_code)]
pub(crate) fn log1p_sat(x: f64, sat: f64) -> f64 {
    if sat <= 0.0 {
        return 0.0;
    }
    clamp01(x.max(0.0).ln_1p() / sat.ln_1p())
}

/// Smoothstep over `[lo,hi]` with C¹ continuity — no cliff at the knee,
/// so micro-padding to cross a threshold buys nothing (anti-gaming for
/// the review-fatigue size bands).
#[allow(dead_code)]
pub(crate) fn smoothstep(x: f64, lo: f64, hi: f64) -> f64 {
    if hi <= lo {
        return if x >= hi { 1.0 } else { 0.0 };
    }
    let t = clamp01((x - lo) / (hi - lo));
    t * t * (3.0 - 2.0 * t)
}

/// Presentational green/amber/red band for a `[0,1]` score. Pass
/// `higher_is_better = false` for `operational_risk` (high score = red).
#[allow(dead_code)]
pub(crate) fn band_for(score: f64, higher_is_better: bool) -> &'static str {
    let s = if higher_is_better { score } else { 1.0 - score };
    if s >= 0.66 {
        "green"
    } else if s >= 0.33 {
        "amber"
    } else {
        "red"
    }
}

// ── orchestrator ──────────────────────────────────────────────────────

use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::pr_signals::PrSignals;
use crate::pr_algorithms::types::{PrQuality, QualityComposite};
use crate::tree::CallTreeNode;
use std::path::Path;

/// Everything the six families need, gathered once in [`merge`](super::merge)
/// (no new CLI plumbing — reuses inputs already computed there).
pub struct QualityInputs<'a> {
    /// Affected-roots forest.
    pub entries: &'a [CallTreeNode],
    /// Changed files (diff stats + paths).
    pub changed_files: &'a [ChangedFile],
    /// PR-scoped findings SSOT.
    pub signals: &'a PrSignals,
    /// Commit subjects (Conventional Commits) for debt-paydown signals.
    pub commit_messages: &'a [String],
    /// Repo root for the defensive source reader (comment/magic/TODO).
    pub repo_root: Option<&'a Path>,
    /// Number of affected entrypoint roots (blast-radius + coverage input).
    pub affected_roots: usize,
    /// Affected roots with no test reaching them (`tests_in_graph`).
    pub uncovered_roots: usize,
    /// New test files added in this PR (`counts`).
    pub new_test_files: usize,
    /// Total graph symbols for `centrality_multiple = pagerank × N`
    /// (`0` = unknown → inversion falls back to fan-in/subtree arms).
    pub total_symbols: usize,
}

/// Build the `pr_quality` block. Families land incrementally; each
/// unimplemented dimension is `Default` (an empty, valid `QualityDimension`)
/// until its module is wired in. The composite is computed once all six
/// dimensions are present (Step 12).
pub fn compute(input: QualityInputs<'_>) -> PrQuality {
    let llm_complexity = llm_complexity::compute(llm_complexity::Inputs {
        entries: input.entries,
        changed_files: input.changed_files,
        findings_count: input.signals.findings.len(),
        total_symbols: input.total_symbols,
    });

    let operational_risk = operational::compute(operational::Inputs {
        entries: input.entries,
        changed_files: input.changed_files,
        signals: input.signals,
        affected_roots: input.affected_roots,
        total_symbols: input.total_symbols,
    });

    let longevity = longevity::compute(longevity::Inputs {
        entries: input.entries,
        changed_files: input.changed_files,
        commit_messages: input.commit_messages,
        signals: input.signals,
        repo_root: input.repo_root,
        total_symbols: input.total_symbols,
    });

    let correctness_confidence = correctness::compute(correctness::Inputs {
        entries: input.entries,
        changed_files: input.changed_files,
        affected_roots: input.affected_roots,
        uncovered_roots: input.uncovered_roots,
        new_test_files: input.new_test_files,
        external_coverage: None, // CLI hook: a real Codecov/Sonar patch-% lifts the cap
    });

    let comprehensibility = comprehensibility::compute(comprehensibility::Inputs {
        entries: input.entries,
        changed_files: input.changed_files,
        commit_messages: input.commit_messages,
        repo_root: input.repo_root,
        total_symbols: input.total_symbols,
    });

    let team_process = team_process::compute(team_process::Inputs {
        changed_files: input.changed_files,
    });

    let mut pq = PrQuality {
        comprehensibility,
        longevity,
        correctness_confidence,
        operational_risk,
        team_process,
        llm_complexity,
        composite: QualityComposite::default(),
        gauges: Vec::new(),
        gauge_summary: Default::default(),
    };
    pq.composite = composite(&pq);
    // Flatten the dimensions into the 18 render-ready gauges + header summary
    // (charts-of-metrics.md). Built last, from the fully-assembled dimensions.
    let (gauges, gauge_summary) = gauges::build(&pq);
    pq.gauges = gauges;
    pq.gauge_summary = gauge_summary;
    pq
}

/// The unified "PR health" headline: a weighted GEOMETRIC mean of the six
/// dimensions (partial non-compensability — a great score can't paper over
/// a fatal one; HDI-2010 / OECD compensability theory), then a
/// non-compensatory destructive-migration cap. Advisory — never gates.
fn composite(pq: &PrQuality) -> QualityComposite {
    use crate::pr_algorithms::types::{CompositeModifier, Confidence, InputValue};

    // Each dimension as a 0..1 "goodness" (operational_risk inverted).
    let g_op = 1.0 - pq.operational_risk.score;
    let dims: [(&str, f64, &str); 6] = [
        ("operational_risk", g_op, "composite.w_operational"),
        ("correctness_confidence", pq.correctness_confidence.score, "composite.w_correctness"),
        ("longevity", pq.longevity.score, "composite.w_longevity"),
        ("comprehensibility", pq.comprehensibility.score, "composite.w_comprehensibility"),
        ("team_process", pq.team_process.score, "composite.w_team"),
        ("llm_complexity", pq.llm_complexity.reviewability.score, "composite.w_llm"),
    ];

    let eps = pq_num("composite.epsilon");
    let mut weights = std::collections::BTreeMap::new();
    let mut ln_acc = 0.0_f64;
    for (name, g, wkey) in dims {
        let w = pq_num(wkey);
        weights.insert(name.to_string(), w);
        ln_acc += w * clamp01(g).max(eps).ln();
    }
    let mut score = clamp01(ln_acc.exp());

    // Non-compensatory modifiers (applied AFTER the mean, not averaged in).
    let mut modifiers = Vec::new();
    let destructive = matches!(
        pq.operational_risk.inputs.get("destructive_migration"),
        Some(InputValue::Bool(true))
    );
    if destructive {
        let cap = pq_num("composite.destructive_cap");
        score = score.min(cap);
        modifiers.push(CompositeModifier {
            kind: "operational_floor".into(),
            active: true,
            detail: format!("destructive migration caps PR-health at {cap:.2}"),
        });
    }
    if pq.llm_complexity.inversion.active {
        modifiers.push(CompositeModifier {
            kind: "inversion".into(),
            active: true,
            detail: pq.llm_complexity.inversion.detail.clone(),
        });
    }

    // Letter band + rubric word.
    let (band, label) = if score >= pq_num("composite.band_a") {
        ("A", "ship with confidence")
    } else if score >= pq_num("composite.band_b") {
        ("B", "ship with care")
    } else if score >= pq_num("composite.band_c") {
        ("C", "review closely")
    } else if score >= pq_num("composite.band_d") {
        ("D", "significant concerns")
    } else {
        ("E", "do not merge as-is")
    };

    // Confidence = min across the six dimensions (weakest evidence governs).
    let confidence = [
        pq.operational_risk.confidence,
        pq.correctness_confidence.confidence,
        pq.longevity.confidence,
        pq.comprehensibility.confidence,
        pq.team_process.confidence,
        pq.llm_complexity.reviewability.confidence,
    ]
    .into_iter()
    .map(conf_rank)
    .min()
    .map(rank_conf)
    .unwrap_or(Confidence::Low);

    QualityComposite {
        score: (score * 100.0).round() / 100.0,
        band: band.into(),
        label: label.into(),
        confidence,
        aggregation: "weighted_geometric_mean".into(),
        weights,
        modifiers,
        notes: vec![
            "Advisory — does not gate the merge. Weighted geometric mean (partial \
             non-compensability); destructive migrations apply a hard cap."
                .into(),
        ],
    }
}

fn conf_rank(c: crate::pr_algorithms::types::Confidence) -> u8 {
    use crate::pr_algorithms::types::Confidence::*;
    match c {
        Low => 0,
        Medium => 1,
        High => 2,
    }
}
fn rank_conf(r: u8) -> crate::pr_algorithms::types::Confidence {
    use crate::pr_algorithms::types::Confidence::*;
    match r {
        2 => High,
        1 => Medium,
        _ => Low,
    }
}

#[cfg(test)]
mod prop_tests {
    //! Property-based invariants for the scoring math + the orchestrator.
    //! These are the bulletproofing guarantees: a malformed score (NaN/Inf
    //! or out of [0,1]) would corrupt the sticky PR comment (serde rejects
    //! non-finite floats); a non-deterministic score would flip the comment
    //! between identical re-runs.
    use super::*;
    use crate::pr_algorithms::counts::ChangedFile;
    use crate::pr_algorithms::pr_signals::PrSignals;
    use crate::pr_algorithms::test_helpers::mk_node;
    use crate::tree::CallTreeNode;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn clamp01_always_bounded_and_finite(x in any::<f64>()) {
            let c = clamp01(x);
            prop_assert!(c.is_finite() && (0.0..=1.0).contains(&c));
        }

        #[test]
        fn log1p_sat_bounded_and_monotone(a in 0.0f64..1e6, d in 0.0f64..1e6, sat in 1.0f64..1e6) {
            let lo = log1p_sat(a, sat);
            let hi = log1p_sat(a + d, sat);
            prop_assert!((0.0..=1.0).contains(&lo));
            prop_assert!(hi >= lo - 1e-9, "log1p_sat must be non-decreasing");
        }

        #[test]
        fn smoothstep_bounded_and_monotone(x in -1e5f64..1e5, lo in 0.0f64..100.0, span in 1.0f64..100.0) {
            let hi = lo + span;
            let v = smoothstep(x, lo, hi);
            prop_assert!((0.0..=1.0).contains(&v));
            prop_assert!(smoothstep(x + 1.0, lo, hi) >= v - 1e-9);
        }

        #[test]
        fn token_estimate_monotone(a in 0usize..200_000, b in 0usize..200_000) {
            if a <= b {
                prop_assert!(tokens::estimate_from_bytes(a) <= tokens::estimate_from_bytes(b));
            }
        }
    }

    fn cf_strategy() -> impl Strategy<Value = ChangedFile> {
        (
            "[a-z]{1,8}",
            0usize..2000,
            0usize..2000,
            prop_oneof![
                Just(Some("added".to_string())),
                Just(Some("modified".to_string())),
                Just(Some("removed".to_string())),
                Just(Some("renamed".to_string())),
                Just(None),
            ],
        )
            .prop_map(|(name, add, del, status)| ChangedFile {
                path: format!("src/{name}.rs"),
                additions: add,
                deletions: del,
                status,
                old_path: None,
            })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(80))]
        #[test]
        fn orchestrator_scores_bounded_finite_deterministic_order_independent(
            files in prop::collection::vec(cf_strategy(), 0..12),
            roots in 0usize..20,
            uncovered in 0usize..20,
            new_tests in 0usize..5,
        ) {
            // A fixed small forest so the order-independence check varies
            // ONLY changed-file order, not which nodes are present.
            let entries: Vec<CallTreeNode> =
                files.iter().take(4).map(|f| mk_node("fn", &f.path)).collect();
            let sig = PrSignals::default();
            let mk = |cfs: &[ChangedFile]| {
                compute(QualityInputs {
                    entries: &entries,
                    changed_files: cfs,
                    signals: &sig,
                    commit_messages: &[],
                    repo_root: None,
                    affected_roots: roots,
                    uncovered_roots: uncovered.min(roots),
                    new_test_files: new_tests,
                    total_symbols: 0,
                })
            };

            let pq = mk(&files);
            for s in [
                pq.comprehensibility.score,
                pq.longevity.score,
                pq.correctness_confidence.score,
                pq.operational_risk.score,
                pq.team_process.score,
                pq.llm_complexity.reviewability.score,
                pq.composite.score,
            ] {
                prop_assert!(s.is_finite(), "non-finite score");
                prop_assert!((0.0..=1.0).contains(&s), "score out of [0,1]: {s}");
            }
            prop_assert!(!pq.composite.band.is_empty());

            // Determinism: identical inputs → identical headline.
            prop_assert_eq!(pq.composite.score, mk(&files).composite.score);

            // Order-independence: shuffling changed-file order must not move
            // the composite (the aggregates are commutative sums/maxes).
            let mut rev = files.clone();
            rev.reverse();
            let pq_rev = mk(&rev);
            prop_assert!(
                (pq.composite.score - pq_rev.composite.score).abs() < 1e-9,
                "file order changed composite: {} vs {}",
                pq.composite.score,
                pq_rev.composite.score
            );
        }
    }
}
