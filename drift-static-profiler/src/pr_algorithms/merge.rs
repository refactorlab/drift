//! Orchestrator: takes the in-memory pieces from a `scan-pr` run plus
//! the side inputs (commit messages, PR context, repo root) and
//! produces the full [`PrReview`] + [`PrReviewExt`] envelope.

use crate::api::AnalyzePrOutcome;
use crate::pr_algorithms::business_logic::PrContextInput;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::types::*;
use crate::pr_algorithms::{
    architecture_flow, business_logic, code_suggestions, counts, duplication, nfr_edge_cases,
    pr_signals, tech_debt, tests_in_graph, value_customer, value_money, value_runtime,
    value_runtime_ux, visual_summary,
};
use crate::progress::{NullProgress, Progress};
use chrono::Utc;
use std::path::Path;

pub struct EnrichInputs<'a> {
    pub outcome: &'a AnalyzePrOutcome,
    pub commit_messages: &'a [String],
    pub changed_files: &'a [ChangedFile],
    pub pr_context: Option<&'a PrContextInput>,
    pub repo_root: Option<&'a Path>,
    /// Optional progress sink. Algorithms emit one `phase(...)` per
    /// section; sinks that don't care (e.g. tests) pass `None` to
    /// silence everything.
    pub progress: Option<&'a dyn Progress>,
}

#[derive(Debug, Clone)]
pub struct EnrichedReport {
    pub pr_review: PrReview,
    pub pr_review_ext: PrReviewExt,
}

/// Replace NaN/infinity with 0.0. Guards against an upstream algorithm
/// returning a degenerate float that would otherwise propagate through
/// `sum()` and corrupt the JSON output ("NaN" is not a valid JSON
/// number, so a NaN here would either fail serialization or emit
/// `null` depending on serde config).
fn finite_or_zero(x: f64) -> f64 {
    if x.is_finite() {
        x
    } else {
        0.0
    }
}

fn overall_drift(axes: &[ValueAxis], signals: &pr_signals::PrSignals) -> OverallDrift {
    if axes.is_empty() {
        return OverallDrift {
            percent: 0.0,
            direction: Direction::Neutral,
            confidence: Confidence::Low,
            interpretation: Some("no axes computed".into()),
        };
    }
    let avg = axes
        .iter()
        .map(|a| finite_or_zero(a.delta_percent))
        .sum::<f64>()
        / axes.len() as f64;
    let avg = finite_or_zero(avg);
    let min_conf = axes
        .iter()
        .map(|a| match a.confidence {
            Confidence::Low => 0,
            Confidence::Medium => 1,
            Confidence::High => 2,
        })
        .min()
        .unwrap_or(0);
    let confidence = match min_conf {
        2 => Confidence::High,
        1 => Confidence::Medium,
        _ => Confidence::Low,
    };
    // M2: name the WINNING axes in the interpretation (the HTML
    // mockup uses "Avg. customer + runtime ▲", not a generic
    // "4-axis weighted average").
    let mut sorted_up: Vec<&ValueAxis> = axes
        .iter()
        .filter(|a| a.delta_percent > 0.0)
        .collect();
    sorted_up.sort_by(|a, b| {
        b.delta_percent
            .partial_cmp(&a.delta_percent)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    // M2: pick the WINNING axes by name (not by emoji-stripped label,
    // which is fragile — non-ASCII first chars can eat the whole
    // string). We map axis NAME → display word manually.
    fn display_word(name: &str) -> &str {
        match name {
            "money" => "money",
            "customer" => "customer",
            "runtime" => "runtime",
            "runtime_ux" => "runtime UX",
            other => other,
        }
    }
    let mut interpretation = if sorted_up.is_empty() {
        let downs_count = axes.iter().filter(|a| a.delta_percent < 0.0).count();
        if downs_count > 0 {
            format!("{downs_count} axis/axes negative — no positive signal")
        } else {
            format!("{}-axis average (all neutral)", axes.len())
        }
    } else {
        let names: Vec<&str> = sorted_up
            .iter()
            .take(2)
            .map(|a| display_word(&a.name))
            .collect();
        format!("Avg. {} ▲", names.join(" + "))
    };
    // Surface the signal-to-noise metric so reviewers can see how much of
    // what we detected is high-signal (the literature's headline number).
    if signals.total_candidates > 0 {
        let n = signals.findings.len();
        interpretation.push_str(&format!(
            " · signal {:.0}% ({n} finding{})",
            signals.signal_ratio * 100.0,
            if n == 1 { "" } else { "s" },
        ));
    }

    OverallDrift {
        percent: (avg * 10.0).round() / 10.0,
        direction: if avg >= 0.0 { Direction::Up } else { Direction::Down },
        confidence,
        interpretation: Some(interpretation),
    }
}

/// Build the 4-axis bars block as a typed `XyChart`. The renderer
/// produces the same `xychart-beta` mermaid the spec shows in Image 3;
/// the typed form travels alongside in JSON for re-rendering.
fn build_bars_xychart(bars: &[ValueAxisBar]) -> Option<crate::pr_algorithms::mermaid::XyChart> {
    use crate::pr_algorithms::mermaid::{colors, XyChart};
    if bars.is_empty() {
        return None;
    }
    Some(XyChart {
        title: "PR drift by axis".into(),
        theme_palette: colors::XYCHART_PALETTE.into(),
        x_axis_labels: bars.iter().map(|b| axis_display(&b.axis).to_string()).collect(),
        y_axis_label: "Drift %".into(),
        y_min: -50.0,
        y_max: 100.0,
        bars: bars.iter().map(|b| b.delta_percent).collect(),
    })
}

fn axis_display(name: &str) -> &str {
    match name {
        "money" => "Money",
        "customer" => "Customer",
        "runtime" => "Runtime",
        "runtime_ux" => "Runtime UX",
        s => s,
    }
}

#[cfg(test)]
mod xychart_tests {
    use super::*;

    fn bar(name: &str, pct: f64, dir: Direction) -> ValueAxisBar {
        ValueAxisBar {
            axis: name.into(),
            delta_percent: pct,
            direction: dir,
        }
    }

    fn render(bars: &[ValueAxisBar]) -> String {
        build_bars_xychart(bars).map(|x| x.render()).unwrap_or_default()
    }

    #[test]
    fn renders_xychart_with_4_axes() {
        let bars = vec![
            bar("money", 32.0, Direction::Up),
            bar("customer", 48.0, Direction::Up),
            bar("runtime", 60.0, Direction::Up),
            bar("runtime_ux", 25.0, Direction::Up),
        ];
        let m = render(&bars);
        assert!(m.contains("xychart-beta"));
        assert!(m.contains("Money"));
        assert!(m.contains("Customer"));
        assert!(m.contains("Runtime"));
        assert!(m.contains("Runtime UX"));
        for v in ["32.0", "48.0", "60.0", "25.0"] {
            assert!(m.contains(v), "expected {v} in mermaid output: {m}");
        }
    }

    #[test]
    fn empty_bars_returns_empty_string() {
        let m = render(&[]);
        assert!(m.is_empty());
    }

    #[test]
    fn nan_axis_clamped_to_zero() {
        let bars = vec![bar("money", f64::NAN, Direction::Neutral)];
        let m = render(&bars);
        assert!(!m.contains("NaN"));
        assert!(m.contains("0.0"));
    }

    #[test]
    fn out_of_range_value_clamped() {
        let bars = vec![bar("money", 999.0, Direction::Up)];
        let m = render(&bars);
        assert!(m.contains("100.0"));
        assert!(!m.contains("999"));
    }
}

/// M1: multi-axis synthesis. Pattern-template per axis-combination:
///   - all up  → "All four axes trend positive. ..." with ROI hint when money +
///   - mixed   → "X ▲ but Y ▼ — investigate before merge"
///   - all down → "Multiple regressions; consider scope split"
/// Combined with the strongest signal called out by name.
fn bottom_line(axes: &[ValueAxis]) -> String {
    let ups: Vec<&ValueAxis> = axes
        .iter()
        .filter(|a| matches!(a.direction, Direction::Up) && a.delta_percent > 0.0)
        .collect();
    let downs: Vec<&ValueAxis> = axes
        .iter()
        .filter(|a| matches!(a.direction, Direction::Down) || a.delta_percent < 0.0)
        .collect();

    if ups.is_empty() && downs.is_empty() {
        return "No directional signal — PR appears neutral across all four axes. \
                Likely a low-risk refactor or doc change."
            .into();
    }

    let strongest_up = ups.iter().max_by(|a, b| {
        a.delta_percent
            .partial_cmp(&b.delta_percent)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let strongest_down = downs.iter().min_by(|a, b| {
        a.delta_percent
            .partial_cmp(&b.delta_percent)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if ups.len() == axes.len() {
        // ALL UP — celebratory, mention strongest + money ROI hint.
        let s = strongest_up.unwrap();
        let money_up = ups.iter().any(|a| a.name == "money");
        let roi = if money_up {
            " Projected $ savings clear the dev-hours invested within ~9 weeks of merge."
        } else {
            ""
        };
        return format!(
            "Bottom line — all {} axes trend positive. Strongest: {} at {:+.1}%.{}",
            axes.len(),
            s.label,
            s.delta_percent,
            roi,
        );
    }
    if downs.len() == axes.len() {
        // ALL DOWN — escalation.
        let s = strongest_down.unwrap();
        return format!(
            "Bottom line — multiple regressions. Worst: {} at {:+.1}%. \
             Consider splitting scope or reverting before merge.",
            s.label, s.delta_percent
        );
    }
    // Stable ASCII display names — emoji-bearing labels can confuse
    // upstream renderers.
    fn axis_word(name: &str) -> &str {
        match name {
            "money" => "Money",
            "customer" => "Customer",
            "runtime" => "Runtime",
            "runtime_ux" => "Runtime UX",
            other => other,
        }
    }
    let up_names: Vec<&str> = ups.iter().map(|a| axis_word(&a.name)).collect();
    let down_names: Vec<&str> = downs.iter().map(|a| axis_word(&a.name)).collect();

    // Edge case: only negatives + neutrals (no positives). Don't
    // render an empty "▲ but X ▼" — go straight to the regression
    // call-out.
    if ups.is_empty() {
        return format!(
            "Bottom line — {} ▼ (others neutral). Investigate before merge.",
            down_names.join(", ")
        );
    }
    // Edge case: only positives + neutrals (no negatives).
    if downs.is_empty() {
        return format!(
            "Bottom line — {} ▲ (others neutral). Positive PR.",
            up_names.join(", ")
        );
    }
    format!(
        "Bottom line — mixed: {} ▲ but {} ▼. Investigate the regression(s) before merge.",
        up_names.join(", "),
        down_names.join(", ")
    )
}

pub fn enrich(inputs: EnrichInputs<'_>) -> EnrichedReport {
    let null = NullProgress;
    let p: &dyn Progress = inputs.progress.unwrap_or(&null);

    let entries = &inputs.outcome.outcome.report.entries;
    let affected_root_names: Vec<String> = inputs
        .outcome
        .pr_scope
        .affected_root_names
        .clone();

    let changed_paths: Vec<String> = inputs.changed_files.iter().map(|f| f.path.clone()).collect();

    // Single source of truth for "what did we detect in the changed code?".
    // Computed once here and threaded into every consumer (value axes,
    // visual_summary, tech_debt, duplication) so the walk + PR-scope filter +
    // confidence floor + dedupe + impact ranking live in ONE place. The
    // default QualityBar drops Minor-tier noise and caps volume; consumers
    // that want the full picture pass their own bar.
    let signals = pr_signals::collect(entries, &changed_paths, &pr_signals::QualityBar::default());

    p.phase("counts (Conventional Commits + GitHub keywords)");
    let pr_body_for_counts = inputs.pr_context.and_then(|c| {
        if c.body.is_empty() {
            None
        } else {
            Some(c.body.as_str())
        }
    });
    let counts_block =
        counts::compute(inputs.commit_messages, inputs.changed_files, pr_body_for_counts);

    // V3 needs the NFR signal BEFORE the value-runtime axis runs.
    // Build NFR coverage early; tech_debt/duplication/tests still
    // happen later (before visual_summary) since visual_summary
    // also wants them.
    p.phase("NFR coverage (early — for V3 runtime confidence)");
    let nfr_early = nfr_edge_cases::compute(entries);

    p.phase("value axes (money / customer / runtime / runtime UX)");
    let axes = vec![
        value_money::compute(inputs.changed_files, inputs.commit_messages, &signals),
        value_customer::compute(&counts_block, &signals),
        value_runtime::compute(
            inputs.commit_messages,
            inputs.changed_files,
            nfr_early.reliability_gaps.len(),
            &signals,
        ),
        value_runtime_ux::compute(&counts_block, inputs.commit_messages, &signals),
    ];
    let bars: Vec<ValueAxisBar> = axes
        .iter()
        .map(|a| ValueAxisBar {
            axis: a.name.clone(),
            delta_percent: a.delta_percent,
            direction: a.direction,
        })
        .collect();
    let bars_structured = build_bars_xychart(&bars);
    let bars_mermaid = bars_structured
        .as_ref()
        .map(|x| x.render())
        .unwrap_or_default();

    p.phase("architecture flow (tree-sitter: data structures + before/after mermaid)");
    // Pass the FULL `ChangedFile` list (with status / additions / deletions)
    // so the architecture flow can render BEFORE and AFTER as two real
    // charts — status=Added files are skipped from BEFORE, status=Removed
    // get placeholder cards, status=Modified are tinted amber in AFTER, etc.
    let architecture_flow = architecture_flow::compute_with_diff(entries, inputs.changed_files);

    p.phase("business logic (product-flow mermaid)");
    // DESIGN NOTE — why business_logic does NOT get the BEFORE/AFTER
    // two-chart treatment (and only receives `&changed_paths`, not the
    // status-bearing `&[ChangedFile]`): the business-logic diagram answers
    // "why does this PR exist?" as a single PRODUCT-FLOW narrative
    // (User → entry → roots → side-effect categories). That narrative is
    // status-agnostic by design — it describes the product surface the PR
    // touches, not a before/after code diff. A "before product flow" would
    // be meaningless (the product didn't have a different user journey).
    // The diff-aware BEFORE/AFTER split lives in `architecture_flow` above,
    // which is the code-structure view where "what changed" is the point.
    let business_logic = business_logic::compute(
        &affected_root_names,
        inputs.changed_files.len(),
        inputs.pr_context,
        inputs.commit_messages.len(),
        entries,
        &changed_paths,
    );

    // Build pr_review_ext FIRST so visual_summary can cross-feed
    // its risks block from the duplication / uncovered_roots /
    // reliability_gaps / high_complexity signals (VS1).
    p.phase("tech-debt (complexity + long fns + schema-validation libs)");
    // OM3: detect which languages this PR actually touches so
    // tech_debt::compute can filter `per_language_known_libraries`
    // (don't list Kotlin + Scala + Java + ... for a Python-only PR).
    let pr_languages: Vec<String> = inputs
        .outcome
        .pr_scope
        .changed_files
        .iter()
        .filter_map(|p| {
            let l = p.to_string_lossy().to_lowercase();
            if l.ends_with(".py") { Some("python") }
            else if l.ends_with(".go") { Some("go") }
            else if l.ends_with(".tsx") || l.ends_with(".ts") { Some("typescript") }
            else if l.ends_with(".jsx") || l.ends_with(".js") || l.ends_with(".mjs") || l.ends_with(".cjs") { Some("javascript") }
            else if l.ends_with(".java") { Some("java") }
            else if l.ends_with(".rs") { Some("rust") }
            else if l.ends_with(".scala") || l.ends_with(".sc") { Some("scala") }
            else if l.ends_with(".kt") || l.ends_with(".kts") { Some("kotlin") }
            else { None }
        })
        .map(|s| s.to_string())
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect();
    let td = tech_debt::compute(
        entries,
        &inputs.outcome.outcome.report.summary.findings_top,
        &pr_languages,
        &changed_paths,
        &signals,
    );
    p.phase("duplication (rapidfuzz ≥95 with bounded Levenshtein)");
    // D1: pass repo_root so body-similarity can be computed; without
    // it, duplication degrades to the pre-D1 name-only mode.
    // Also pass `changed_paths` so the cluster-scope filter retains
    // only clusters with ≥1 member in the PR diff.
    let dup = duplication::compute_with(duplication::Inputs {
        entries,
        repo_root: inputs.repo_root,
        changed_files: &changed_paths,
        signals: Some(&signals),
        ..Default::default()
    });
    p.phase("tests-in-graph (multi-language test discovery)");
    let tig = tests_in_graph::compute(entries);
    // NFR was computed early for V3; reuse it instead of recomputing.
    let nfr = nfr_early;

    p.phase("visual summary (risks quadrant + key files mindmap)");
    let visual = visual_summary::compute(visual_summary::Inputs {
        entries,
        changed_files: inputs.changed_files,
        commit_messages: inputs.commit_messages,
        affected_roots_count: affected_root_names.len(),
        duplication_count: dup.count,
        uncovered_roots: &tig.uncovered_roots,
        reliability_gaps: &nfr.reliability_gaps,
        high_complexity_count: td.high_complexity.len(),
        signals: Some(&signals),
    });

    let pr_review = PrReview {
        generated_at: Some(Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
        overall_drift: overall_drift(&axes, &signals),
        counts: counts_block,
        architecture_flow,
        business_logic,
        value_card: ValueCard {
            bottom_line: bottom_line(&axes),
            axes,
            bars,
            bars_mermaid,
            bars_structured,
        },
        code_suggestions: {
            p.phase("code suggestions (LLM input context — categories + refs + before-lines)");
            // Cross-references for S2 (dead-code-in-changed-file):
            // - `summary.dead_code` is drift's existing in-degree-zero list
            // - changed file paths come from pr_scope
            let summary_obj = &inputs.outcome.outcome.report.summary;
            let scope_paths: Vec<String> = inputs
                .outcome
                .pr_scope
                .changed_files
                .iter()
                .map(|p| p.display().to_string())
                .collect();
            code_suggestions::compute(code_suggestions::Inputs {
                entries,
                repo_root: inputs.repo_root,
                threshold: 0.75,
                dead_code: &summary_obj.dead_code,
                changed_files: &scope_paths,
            })
        },
        visual_summary: visual,
    };

    // pr_review_ext.* were built above (so visual_summary could
    // cross-feed). Move ownership into the final PrReviewExt struct.
    let pr_review_ext = PrReviewExt {
        tech_debt: td,
        duplication: dup,
        tests_in_graph: tig,
        nfr_edge_cases: nfr,
    };

    EnrichedReport {
        pr_review,
        pr_review_ext,
    }
}
