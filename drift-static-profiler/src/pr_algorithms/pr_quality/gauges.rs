//! pr_quality::gauges — flatten the six dimensions into the 18 render-ready
//! gauge metrics the PR comment shows (charts-of-metrics.md).
//!
//! All orientation/normalization lives HERE (in tested Rust) so the TS
//! renderer is a dumb presenter. Each gauge carries:
//! - `score` 0..100 (raw value → BAR LENGTH),
//! - `higher_is_better` (quality vs risk polarity),
//! - `level` banded on the RISK magnitude (`hib ? 100−score : score`) so
//!   green=good / red=bad ALWAYS — matching the doc's visible examples
//!   (reviewability 28 → red) and resolving its prose-vs-example ambiguity.
//!
//! Inversions (my internal orientation → the chart's): `context_dependency`,
//! `edge_case_surface`, and `observability` are emitted as *goodness* by their
//! dimensions but the chart wants *risk* (or vice-versa) — flipped here.

use super::clamp01;
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::types::*;

/// Standard-agent context window the "fits in context" badge is judged
/// against (the doc's 128k framing — many review agents still cap here even
/// as frontier windows reach 1M).
const STANDARD_AGENT_WINDOW: usize = 128_000;

fn comp(dim: &QualityDimension, key: &str) -> f64 {
    dim.components
        .iter()
        .find(|c| c.key == key)
        .map(|c| c.value)
        .unwrap_or(0.0)
}

fn pct(x: f64) -> u8 {
    (clamp01(x) * 100.0).round() as u8
}

fn level_for(risk: f64) -> &'static str {
    if risk >= pq_num("gauge.band_critical_min") {
        "critical"
    } else if risk >= pq_num("gauge.band_high_min") {
        "high"
    } else if risk >= pq_num("gauge.band_moderate_min") {
        "moderate"
    } else {
        "low"
    }
}

fn risk_of(g: &QualityGauge) -> u8 {
    if g.higher_is_better {
        100u8.saturating_sub(g.score)
    } else {
        g.score
    }
}

fn gauge(id: &str, group: &str, label: &str, score: u8, higher_is_better: bool, description: &str) -> QualityGauge {
    let risk = if higher_is_better {
        100.0 - score as f64
    } else {
        score as f64
    };
    QualityGauge {
        id: id.into(),
        group: group.into(),
        label: label.into(),
        score,
        higher_is_better,
        level: level_for(risk).into(),
        arrow: if higher_is_better { "↓" } else { "↑" }.into(),
        description: description.into(),
    }
}

/// Project the assembled dimensions into the 18 gauges + the header summary.
pub fn build(pq: &PrQuality) -> (Vec<QualityGauge>, GaugeSummary) {
    let llm = &pq.llm_complexity;

    // ── LLM-complexity normalizations (raw inputs → 0..100) ───────────
    let tokens = llm.token_footprint.estimate;
    let budget = llm.context.usable_budget.max(1);
    let footprint_pct = ((tokens as f64 / budget as f64) * 100.0).round().clamp(0.0, 100.0) as u8;
    let pressure_pct = (llm.context.load * 100.0).round().clamp(0.0, 100.0) as u8;
    let density_pct: u8 = match llm.semantic_density.band.as_str() {
        "dense" => 25,
        "boilerplate" => 80,
        _ => 50,
    };

    let g = vec![
        // 1 · LLM Complexity
        gauge("token_footprint", "LLM Complexity", "Token footprint", footprint_pct, false,
            "How many tokens this PR consumes when fed to a model — a direct proxy for how hard it is to reason about automatically."),
        gauge("context_window_pressure", "LLM Complexity", "Context window pressure", pressure_pct, false,
            "Does the full diff fit in a single context window, or must it be chunked? Chunking loses semantic coherence and misses cross-file coupling."),
        gauge("agent_reviewability", "LLM Complexity", "Agent reviewability", pct(llm.reviewability.score), true,
            "Can an LLM give useful feedback, or is the change too large and tangled to reason about reliably?"),
        gauge("semantic_density", "LLM Complexity", "Semantic density", density_pct, false,
            "Tokens per logical change — distinguishes heavy boilerplate from dense, complex business logic."),
        // 2 · Comprehensibility
        gauge("explainability", "Comprehensibility", "Explainability score", pct(comp(&pq.comprehensibility, "explainability")), true,
            "Can an unfamiliar engineer understand the change without asking someone? Comment density, naming clarity, control-flow simplicity."),
        gauge("context_dependency", "Comprehensibility", "Context dependency", pct(1.0 - comp(&pq.comprehensibility, "context_dependency")), false,
            "How much prior knowledge is needed to review this PR? Does it touch highly-coupled core abstractions or isolated modules?"),
        gauge("decision_transparency", "Comprehensibility", "Decision transparency", pct(comp(&pq.comprehensibility, "decision_transparency")), true,
            "Are non-obvious engineering choices explained (algorithm choice, the rationale behind a magic number)?"),
        // 3 · Longevity
        gauge("maintenance_burden", "Longevity", "Maintenance burden", pct(comp(&pq.longevity, "burden")), false,
            "How much will this code need to be touched again? Coupling, hardcoded values, and TODO density."),
        gauge("debt_delta", "Longevity", "Debt introduced vs. resolved", pct(comp(&pq.longevity, "net_debt")), false,
            "Net technical-debt delta from this PR — debt added relative to what it cleans up."),
        gauge("fragility_index", "Longevity", "Fragility index", pct(comp(&pq.longevity, "fragility")), false,
            "How many other components quietly break if this code changes? High fan-out coupling and downstream dependents."),
        // 4 · Correctness Confidence
        gauge("test_coverage", "Correctness Confidence", "Test coverage (changed lines)", pct(comp(&pq.correctness_confidence, "coverage")), true,
            "Not overall coverage — specifically the test reachability of the lines changed or added in this PR."),
        gauge("repeatability", "Correctness Confidence", "Repeatability", pct(comp(&pq.correctness_confidence, "repeatability")), true,
            "Are side effects isolated and deterministic? Can you run this twice and get identical results?"),
        gauge("edge_case_surface", "Correctness Confidence", "Edge case surface", pct(1.0 - comp(&pq.correctness_confidence, "edge_case_surface")), false,
            "The volume of implicit input/state assumptions — high surface means many boundary/failure conditions are easy to overlook."),
        // 5 · Operational
        gauge("rollback_complexity", "Operational", "Rollback complexity", pct(comp(&pq.operational_risk, "rollback")), false,
            "If this fails in production, how hard is the rollback? Migrations, API changes, and stateful data transforms raise it."),
        gauge("observability", "Operational", "Observability", pct(1.0 - comp(&pq.operational_risk, "observability")), true,
            "Does this change add logging/metrics/tracing, or introduce an operational blind spot?"),
        gauge("blast_radius", "Operational", "Blast radius", pct(comp(&pq.operational_risk, "blast_radius")), false,
            "What share of the system is exposed if this breaks? Centrality, entrypoint reach, and fan-in."),
        // 6 · Team & Process
        gauge("knowledge_concentration", "Team & Process", "Knowledge concentration", pct(comp(&pq.team_process, "knowledge_concentration")), false,
            "Is the change concentrated in code only a few people own? A static specialization proxy (not a git bus factor)."),
        gauge("review_fatigue", "Team & Process", "Review fatigue risk", pct(comp(&pq.team_process, "review_fatigue")), false,
            "Large diffs lose reviewer attention past the first half."),
    ];

    // ── header summary ────────────────────────────────────────────────
    let mut by_risk: Vec<&QualityGauge> = g.iter().collect();
    by_risk.sort_by(|a, b| {
        risk_of(b)
            .cmp(&risk_of(a))
            .then_with(|| a.label.cmp(&b.label))
    });
    let highest: Vec<GaugeRef> = by_risk
        .iter()
        .take(4)
        .map(|x| GaugeRef { label: x.label.clone(), score: x.score })
        .collect();
    let lowest: Vec<GaugeRef> = by_risk
        .iter()
        .rev()
        .take(2)
        .map(|x| GaugeRef { label: x.label.clone(), score: x.score })
        .collect();

    let summary = GaugeSummary {
        context_fits: tokens <= STANDARD_AGENT_WINDOW,
        token_estimate: tokens,
        token_limit: STANDARD_AGENT_WINDOW,
        highest,
        lowest,
    };

    (g, summary)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a PrQuality with the six dimensions' components set, mirroring
    /// what the family modules emit, to exercise the projection.
    fn sample() -> PrQuality {
        let dim = |comps: &[(&str, f64)]| QualityDimension {
            components: comps
                .iter()
                .map(|(k, v)| QualityComponent {
                    key: (*k).into(),
                    value: *v,
                    weight: 0.0,
                    detail: String::new(),
                })
                .collect(),
            ..Default::default()
        };
        PrQuality {
            comprehensibility: dim(&[("explainability", 0.4), ("context_dependency", 0.1), ("decision_transparency", 0.45)]),
            longevity: dim(&[("fragility", 0.85), ("net_debt", 0.75), ("burden", 0.70)]),
            correctness_confidence: dim(&[("coverage", 0.55), ("repeatability", 0.50), ("edge_case_surface", 0.25)]),
            operational_risk: dim(&[("rollback", 0.80), ("blast_radius", 0.95), ("observability", 0.65)]),
            team_process: dim(&[("review_fatigue", 0.90), ("knowledge_concentration", 0.82)]),
            llm_complexity: LlmComplexity {
                reviewability: QualityDimension { score: 0.28, ..Default::default() },
                token_footprint: TokenFootprint { estimate: 134_000, ..Default::default() },
                context: ContextPressure { load: 0.88, usable_budget: 275_000, ..Default::default() },
                semantic_density: SemanticDensity { value: 78.0, band: "boilerplate".into() },
                inversion: InversionFlag::default(),
            },
            ..Default::default()
        }
    }

    #[test]
    fn builds_exactly_eighteen_gauges_all_valid() {
        let (g, _) = build(&sample());
        assert_eq!(g.len(), 18, "expected 18 gauges");
        for x in &g {
            assert!(x.score <= 100, "{} score out of range", x.id);
            assert!(["low", "moderate", "high", "critical"].contains(&x.level.as_str()), "{} bad level {}", x.id, x.level);
            assert!(["↑", "↓"].contains(&x.arrow.as_str()));
            assert!(!x.description.is_empty());
        }
    }

    #[test]
    fn polarity_flags_are_correct() {
        let (g, _) = build(&sample());
        let hib: std::collections::BTreeMap<&str, bool> =
            g.iter().map(|x| (x.id.as_str(), x.higher_is_better)).collect();
        // quality metrics (higher = better)
        for id in ["agent_reviewability", "explainability", "decision_transparency", "test_coverage", "repeatability", "observability"] {
            assert!(hib[id], "{id} should be higher_is_better");
        }
        // risk metrics (higher = worse)
        for id in ["token_footprint", "context_dependency", "maintenance_burden", "fragility_index", "edge_case_surface", "rollback_complexity", "blast_radius", "review_fatigue"] {
            assert!(!hib[id], "{id} should be a risk metric");
        }
    }

    #[test]
    fn inversions_applied() {
        let (g, _) = build(&sample());
        let by_id = |id: &str| g.iter().find(|x| x.id == id).unwrap().clone();
        // context_dependency: ease 0.1 → dependency risk 90
        assert_eq!(by_id("context_dependency").score, 90);
        // edge_case_surface: goodness 0.25 → surface risk 75
        assert_eq!(by_id("edge_case_surface").score, 75);
        // observability: blind-spot risk 0.65 → observability quality 35
        assert_eq!(by_id("observability").score, 35);
        // agent reviewability passes through (0.28 → 28)
        assert_eq!(by_id("agent_reviewability").score, 28);
    }

    #[test]
    fn risk_banding_makes_green_good_red_bad() {
        let (g, _) = build(&sample());
        let by_id = |id: &str| g.iter().find(|x| x.id == id).unwrap().clone();
        // blast radius 95 (risk) → critical
        assert_eq!(by_id("blast_radius").level, "critical");
        // agent reviewability 28 (quality) → risk 72 → high (red-ish), per the doc example
        assert_eq!(by_id("agent_reviewability").level, "high");
        // observability score 35 (quality) → risk 65 → high
        assert_eq!(by_id("observability").level, "high");
    }

    #[test]
    fn summary_context_and_extremes() {
        let (_, s) = build(&sample());
        assert!(!s.context_fits, "134k tokens > 128k → does not fit");
        assert_eq!(s.token_estimate, 134_000);
        assert_eq!(s.token_limit, 128_000);
        // highest risk should lead with blast radius (95)
        assert_eq!(s.highest.first().unwrap().label, "Blast radius");
        assert_eq!(s.highest.first().unwrap().score, 95);
        assert!(!s.lowest.is_empty());
    }

    #[test]
    fn deterministic() {
        let pq = sample();
        let (a, sa) = build(&pq);
        let (b, sb) = build(&pq);
        assert_eq!(a.len(), b.len());
        assert_eq!(serde_json::to_string(&a).unwrap(), serde_json::to_string(&b).unwrap());
        assert_eq!(serde_json::to_string(&sa).unwrap(), serde_json::to_string(&sb).unwrap());
    }

    #[test]
    fn empty_pr_quality_is_safe() {
        let (g, s) = build(&PrQuality::default());
        assert_eq!(g.len(), 18);
        assert!(s.context_fits, "0 tokens fits");
    }

    #[test]
    fn banding_boundaries_are_exact() {
        // LOW 0–39 · MODERATE 40–59 · HIGH 60–79 · CRITICAL 80–100 (on risk).
        for (risk, want) in [
            (0.0, "low"),
            (39.0, "low"),
            (40.0, "moderate"),
            (59.0, "moderate"),
            (60.0, "high"),
            (79.0, "high"),
            (80.0, "critical"),
            (100.0, "critical"),
        ] {
            assert_eq!(level_for(risk), want, "risk {risk}");
        }
    }

    #[test]
    fn quality_vs_risk_banding_inverts() {
        // risk metric: high score = high risk = red.
        assert_eq!(gauge("x", "g", "X", 80, false, "d").level, "critical");
        // quality metric: high score = low risk = green.
        assert_eq!(gauge("x", "g", "X", 80, true, "d").level, "low");
        // quality metric: low score = high risk = red (the doc's reviewability=28 case).
        assert_eq!(gauge("x", "g", "X", 20, true, "d").level, "critical");
        // arrows track polarity.
        assert_eq!(gauge("x", "g", "X", 50, true, "d").arrow, "↓");
        assert_eq!(gauge("x", "g", "X", 50, false, "d").arrow, "↑");
    }
}
