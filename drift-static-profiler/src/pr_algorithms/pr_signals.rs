//! pr_signals — the single, PR-scoped view of the profiler's structured
//! findings, reused by every PR-review algorithm.
//!
//! ## Why this module exists
//!
//! At PR time every [`CallTreeNode`] in the affected-roots forest already
//! carries a fully-populated `findings: Vec<Finding>` — 31 finding kinds
//! (N+1, blocking-in-async, expensive-compute, every ORM/SQL antipattern),
//! each already severity-bumped by impact (pagerank / percent_total /
//! call_site_count) upstream in `insights::bump_severities_by_impact`.
//! Before this module, the value/risk algorithms ignored that goldmine and
//! graded the PR off commit-message prefixes (`perf:`/`feat:`) and LOC.
//!
//! This module projects those findings into one ranked, deduped, scoped,
//! tier-classified list ([`PrSignals`]) so consumers (visual_summary,
//! value_*, tech_debt, code_suggestions, duplication) read from a **single
//! source of truth** instead of each re-walking the tree with its own ad-hoc
//! filter. SRP + DRY (Robert C. Martin): one module owns "what did we
//! actually detect in the changed code, and how much of it is signal?".
//!
//! ## Design rationale
//!
//! - **Pure, no I/O, no per-language code.** Operates only on the
//!   language-agnostic `Finding` / `CallTreeNode` fields, so it satisfies the
//!   project rule that language knowledge lives only in `src/languages/`.
//! - **Clean-as-you-code** (SonarQube): only findings whose anchor is in the
//!   PR's `changed_files` survive — pre-existing tech debt in unchanged code
//!   is not the PR author's problem to fix here.
//! - **Noise policy in one place** ([`QualityBar`]): confidence floor, tier
//!   floor, per-category cap, global cap. The signal-to-noise research
//!   ("fewer actionable comments beat volume") is encoded here, not scattered
//!   across consumers.
//! - **Open/Closed**: new `FindingKind`s flow through automatically via
//!   `FindingKind::category()`; consumers never learn new names.

use crate::insights::{FindingCategory, FindingKind, Severity};
use crate::pr_algorithms::in_pr_changed_files;
use crate::tree::CallTreeNode;
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet};

/// Review-noise tier, derived from (category, severity). Mirrors the
/// three-tier model from the signal-to-noise literature:
///   - `Critical`  — observable harm: act before merge.
///   - `Important`  — pattern violation worth a comment.
///   - `Minor`      — low-stakes; dropped by the default [`QualityBar`].
///
/// Ordering is intentional (`Minor < Important < Critical`) so a tier floor
/// is a simple `tier >= bar.min_tier` comparison.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "snake_case")]
pub enum SignalTier {
    Minor,
    Important,
    Critical,
}

impl SignalTier {
    /// Map a finding's (category, severity) onto a review tier.
    ///
    /// Open/Closed: this is the ONE place tiering lives. A new finding kind
    /// only needs a `FindingKind::category()` arm; its tier falls out here.
    pub fn classify(category: FindingCategory, severity: Severity) -> SignalTier {
        use FindingCategory::*;
        use Severity::*;
        match (category, severity) {
            // Security is never "minor": a Medium is already Important, a
            // High is act-before-merge.
            (Security, High) => SignalTier::Critical,
            (Security, _) => SignalTier::Important,
            // Failure / outage / correctness surfaces: a High finding blocks.
            (Reliability | Sql | Orm | Performance | Ai, High) => SignalTier::Critical,
            (Reliability | Sql | Orm | Performance | Ai, Medium) => SignalTier::Important,
            // Observability / Maintenance never block; a High is worth noting.
            (Observability | Maintenance, High) => SignalTier::Important,
            // Everything else (Low severity, low-stakes categories) is minor.
            _ => SignalTier::Minor,
        }
    }
}

/// One finding projected into the PR view: the language-agnostic facts a
/// consumer needs without re-walking the tree or touching `insights`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PrFinding {
    pub file: String,
    /// `parent_class::name` when the node is a method, else the bare name.
    pub function: String,
    pub line: usize,
    pub kind: FindingKind,
    pub category: FindingCategory,
    pub tier: SignalTier,
    pub severity: Severity,
    /// Detector rule id (`evidence[0].call`, e.g. `DJ-N1-001`), or empty
    /// when the finding carries no rule evidence.
    pub rule_id: String,
    pub confidence: f64,
    /// Call-graph centrality of the owning node — blast radius / how many
    /// paths reach this code. Used as the ranking tie-breaker.
    pub pagerank: f64,
    /// `severity.rank() * confidence` — a single 0..3 actionability number
    /// for consumers that want one scalar (risk likelihood/severity, cost
    /// multipliers). Transparent on purpose; no magic constants.
    pub impact_score: f64,
    pub message: String,
    pub remediation: Option<String>,
    pub n_plus_one_risk: bool,
    pub blocking_in_async: bool,
}

impl PrFinding {
    /// True if this finding degrades runtime — a performance / ORM / SQL
    /// issue, or a blocking call on an async path. Single source of truth
    /// for "runtime-relevant finding", shared by the runtime + money axes
    /// (so the predicate isn't duplicated across modules).
    pub fn is_runtime_degrading(&self) -> bool {
        matches!(
            self.category,
            FindingCategory::Performance | FindingCategory::Orm | FindingCategory::Sql
        ) || self.kind == FindingKind::BlockingInAsync
    }
}

/// The PR-scoped, ranked, deduped, capped view plus the rollups consumers
/// need. Returned by [`collect`].
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct PrSignals {
    /// Surfaced findings, ranked desc by (tier, impact_score, pagerank) and
    /// truncated by the [`QualityBar`] caps.
    pub findings: Vec<PrFinding>,
    pub by_category: BTreeMap<FindingCategory, usize>,
    pub by_tier: BTreeMap<SignalTier, usize>,
    /// (critical + important) / candidates — the signal-to-noise metric.
    /// Measured over the post-scope, post-confidence candidate pool (before
    /// the tier floor and caps) so it reflects detection quality, not the
    /// cap. `1.0` when nothing was detected (no noise).
    pub signal_ratio: f64,
    /// How many findings passed scope + confidence before the tier floor /
    /// caps were applied. Lets consumers reason about volume.
    pub total_candidates: usize,
    /// Resource surface of the *changed* code (union of `categories_reached`
    /// over in-scope nodes). Lets value_money weight infra/db changes.
    pub touches_db: bool,
    pub touches_network: bool,
    pub touches_cache: bool,
}

impl PrSignals {
    pub fn is_empty(&self) -> bool {
        self.findings.is_empty()
    }

    /// Count of surfaced findings at or above `tier`.
    pub fn count_at_least(&self, tier: SignalTier) -> usize {
        self.findings.iter().filter(|f| f.tier >= tier).count()
    }

    /// True if any surfaced finding is in one of `kinds`. Cheap helper for
    /// value_runtime's "did this PR introduce a perf finding?" cross-check.
    pub fn has_any_kind(&self, kinds: &[FindingKind]) -> bool {
        self.findings.iter().any(|f| kinds.contains(&f.kind))
    }

    /// Surfaced findings whose owning function is one of `kinds`.
    pub fn of_kinds<'a>(&'a self, kinds: &'a [FindingKind]) -> impl Iterator<Item = &'a PrFinding> {
        self.findings.iter().filter(move |f| kinds.contains(&f.kind))
    }
}

/// The noise policy. One struct, four knobs — the only place review-volume
/// trade-offs are tuned. [`Default`] is the production policy.
#[derive(Debug, Clone, Copy)]
pub struct QualityBar {
    /// Drop findings below this confidence. Matches code_suggestions' bar.
    pub min_confidence: f64,
    /// Drop findings below this tier. Default `Important` → Minor is noise.
    pub min_tier: SignalTier,
    /// At most this many findings per `FindingCategory` (anti-spray).
    pub per_category_cap: usize,
    /// At most this many findings total.
    pub total_cap: usize,
}

impl Default for QualityBar {
    fn default() -> Self {
        Self {
            min_confidence: 0.75,
            min_tier: SignalTier::Important,
            per_category_cap: 5,
            total_cap: 20,
        }
    }
}

impl QualityBar {
    /// A permissive bar for consumers that want the full detected picture
    /// (e.g. tech_debt rollups) rather than the review-comment shortlist:
    /// keeps Minor findings and lifts the caps, but still honors the
    /// confidence floor.
    pub fn permissive() -> Self {
        Self {
            min_confidence: 0.75,
            min_tier: SignalTier::Minor,
            per_category_cap: usize::MAX,
            total_cap: usize::MAX,
        }
    }
}

/// Iterative DFS over the call-tree forest. Returns every node once.
fn walk(entries: &[CallTreeNode]) -> Vec<&CallTreeNode> {
    let mut out = Vec::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        out.push(n);
        for c in &n.children {
            stack.push(c);
        }
    }
    out
}

/// Project the affected-roots forest into the PR signal view.
///
/// Pipeline: scope (changed files) → confidence floor → dedupe (file, kind,
/// line) → tier-classify → tier floor → rank (tier, impact, pagerank) →
/// per-category cap → global cap.
pub fn collect(entries: &[CallTreeNode], changed_files: &[String], bar: &QualityBar) -> PrSignals {
    let mut candidates: Vec<PrFinding> = Vec::new();
    let mut seen: HashSet<(String, FindingKind, usize)> = HashSet::new();
    let (mut touches_db, mut touches_network, mut touches_cache) = (false, false, false);

    for node in walk(entries) {
        // Clean-as-you-code: only findings in code this PR changed.
        if !in_pr_changed_files(&node.file, changed_files) {
            continue;
        }
        for key in node.categories_reached.keys() {
            match key.as_str() {
                "db" => touches_db = true,
                "network" => touches_network = true,
                "cache" => touches_cache = true,
                _ => {}
            }
        }
        let function = match &node.parent_class {
            Some(c) if !c.is_empty() => format!("{c}::{}", node.name),
            _ => node.name.clone(),
        };
        for f in &node.findings {
            if f.confidence < bar.min_confidence {
                continue;
            }
            let line = if f.line > 0 { f.line } else { node.line };
            // Dedupe identical findings that surface on more than one tree
            // (a changed leaf reached from two roots appears twice).
            if !seen.insert((node.file.clone(), f.kind, line)) {
                continue;
            }
            let category = f.kind.category();
            candidates.push(PrFinding {
                file: node.file.clone(),
                function: function.clone(),
                line,
                kind: f.kind,
                category,
                tier: SignalTier::classify(category, f.severity),
                severity: f.severity,
                rule_id: f
                    .evidence
                    .first()
                    .map(|e| e.call.clone())
                    .unwrap_or_default(),
                confidence: f.confidence,
                pagerank: node.pagerank,
                impact_score: f.severity.rank() as f64 * f.confidence,
                message: f.message.clone(),
                remediation: f.remediation.clone(),
                n_plus_one_risk: node.n_plus_one_risk,
                blocking_in_async: node.blocking_in_async,
            });
        }
    }

    // Signal ratio over the full candidate pool (post-scope, post-confidence,
    // pre-tier-floor) — measures detection quality independent of the caps.
    let total_candidates = candidates.len();
    let high_signal = candidates
        .iter()
        .filter(|c| c.tier >= SignalTier::Important)
        .count();
    let signal_ratio = if total_candidates == 0 {
        1.0
    } else {
        high_signal as f64 / total_candidates as f64
    };

    // Tier floor, then impact ranking.
    candidates.retain(|c| c.tier >= bar.min_tier);
    candidates.sort_by(|a, b| {
        b.tier
            .cmp(&a.tier)
            .then_with(|| {
                b.impact_score
                    .partial_cmp(&a.impact_score)
                    .unwrap_or(Ordering::Equal)
            })
            .then_with(|| b.pagerank.partial_cmp(&a.pagerank).unwrap_or(Ordering::Equal))
    });

    let findings = apply_caps(candidates, bar);

    let mut by_category: BTreeMap<FindingCategory, usize> = BTreeMap::new();
    let mut by_tier: BTreeMap<SignalTier, usize> = BTreeMap::new();
    for f in &findings {
        *by_category.entry(f.category).or_insert(0) += 1;
        *by_tier.entry(f.tier).or_insert(0) += 1;
    }

    PrSignals {
        findings,
        by_category,
        by_tier,
        signal_ratio,
        total_candidates,
        touches_db,
        touches_network,
        touches_cache,
    }
}

/// Apply per-category then global caps to an already-ranked list. Because
/// the input is sorted by impact, the survivors are the most actionable.
fn apply_caps(sorted: Vec<PrFinding>, bar: &QualityBar) -> Vec<PrFinding> {
    let mut per_cat: HashMap<FindingCategory, usize> = HashMap::new();
    let mut out: Vec<PrFinding> = Vec::new();
    for f in sorted {
        if out.len() >= bar.total_cap {
            break;
        }
        let n = per_cat.entry(f.category).or_insert(0);
        if *n >= bar.per_category_cap {
            continue;
        }
        *n += 1;
        out.push(f);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::insights::{Effort, Evidence, Finding};
    use crate::pr_algorithms::test_helpers::{mk_node, with_findings};

    fn finding(kind: FindingKind, severity: Severity, confidence: f64) -> Finding {
        Finding {
            kind,
            severity,
            effort: Effort::Medium,
            confidence,
            line: 42,
            message: format!("{kind:?} message"),
            evidence: vec![Evidence {
                call: "rule_x".into(),
                line: 42,
                category: None,
            }],
            remediation: Some("fix it".into()),
            byte_range: None,
            fidelity: None,
            fusion_paths: vec![],
            predicted_sql: None,
            originating_orm: None,
        }
    }

    #[test]
    fn tier_classification_matches_taxonomy() {
        // Security floors at Important and tops at Critical.
        assert_eq!(
            SignalTier::classify(FindingCategory::Security, Severity::Low),
            SignalTier::Important
        );
        assert_eq!(
            SignalTier::classify(FindingCategory::Security, Severity::High),
            SignalTier::Critical
        );
        // High perf/reliability/orm/sql → Critical; Medium → Important.
        assert_eq!(
            SignalTier::classify(FindingCategory::Performance, Severity::High),
            SignalTier::Critical
        );
        assert_eq!(
            SignalTier::classify(FindingCategory::Orm, Severity::Medium),
            SignalTier::Important
        );
        // Observability/Maintenance never block; Low everywhere is Minor.
        assert_eq!(
            SignalTier::classify(FindingCategory::Observability, Severity::High),
            SignalTier::Important
        );
        assert_eq!(
            SignalTier::classify(FindingCategory::Performance, Severity::Low),
            SignalTier::Minor
        );
    }

    #[test]
    fn scopes_to_changed_files() {
        let entries = vec![
            with_findings(
                mk_node("changed_fn", "src/changed.rs"),
                vec![finding(FindingKind::NPlusOne, Severity::High, 0.9)],
            ),
            with_findings(
                mk_node("other_fn", "src/untouched.rs"),
                vec![finding(FindingKind::NPlusOne, Severity::High, 0.95)],
            ),
        ];
        let sig = collect(
            &entries,
            &["src/changed.rs".to_string()],
            &QualityBar::default(),
        );
        assert_eq!(sig.findings.len(), 1, "only the changed file's finding");
        assert_eq!(sig.findings[0].file, "src/changed.rs");
    }

    #[test]
    fn drops_below_confidence_and_below_tier() {
        let entries = vec![with_findings(
            mk_node("f", "a.rs"),
            vec![
                finding(FindingKind::NPlusOne, Severity::High, 0.50), // below confidence
                finding(FindingKind::NoisyLog, Severity::Low, 0.99),  // Minor tier
                finding(FindingKind::NPlusOne, Severity::Medium, 0.99), // kept (Important)
            ],
        )];
        let sig = collect(&entries, &["a.rs".to_string()], &QualityBar::default());
        assert_eq!(sig.findings.len(), 1);
        assert_eq!(sig.findings[0].severity, Severity::Medium);
    }

    #[test]
    fn dedupes_same_finding_across_trees() {
        // Same (file, kind, line) appears under two roots → counted once.
        let leaf = || {
            with_findings(
                mk_node("leaf", "shared.rs"),
                vec![finding(FindingKind::BlockingInAsync, Severity::High, 0.9)],
            )
        };
        let mut root_a = mk_node("root_a", "a.rs");
        root_a.children = vec![leaf()];
        let mut root_b = mk_node("root_b", "b.rs");
        root_b.children = vec![leaf()];
        let sig = collect(
            &[root_a, root_b],
            &["shared.rs".to_string()],
            &QualityBar::default(),
        );
        assert_eq!(sig.findings.len(), 1, "deduped across both trees");
    }

    #[test]
    fn ranks_critical_before_important_then_by_impact() {
        let entries = vec![with_findings(
            mk_node("f", "a.rs"),
            vec![
                finding(FindingKind::NoisyLog, Severity::High, 0.9), // Important (observability)
                finding(FindingKind::NPlusOne, Severity::High, 0.8), // Critical (perf)
            ],
        )];
        let sig = collect(&entries, &["a.rs".to_string()], &QualityBar::default());
        assert_eq!(sig.findings.len(), 2);
        assert_eq!(sig.findings[0].tier, SignalTier::Critical);
        assert_eq!(sig.findings[0].kind, FindingKind::NPlusOne);
    }

    #[test]
    fn signal_ratio_excludes_minor_noise() {
        let entries = vec![with_findings(
            mk_node("f", "a.rs"),
            vec![
                finding(FindingKind::NPlusOne, Severity::High, 0.9), // Critical
                finding(FindingKind::NoisyLog, Severity::Low, 0.9),  // Minor (noise)
            ],
        )];
        // permissive bar so both reach the candidate pool.
        let sig = collect(&entries, &["a.rs".to_string()], &QualityBar::permissive());
        assert_eq!(sig.total_candidates, 2);
        assert!(
            (sig.signal_ratio - 0.5).abs() < 1e-9,
            "1 of 2 candidates is high-signal, got {}",
            sig.signal_ratio
        );
    }

    #[test]
    fn per_category_cap_limits_spray() {
        let many: Vec<Finding> = (0..10)
            .map(|_| finding(FindingKind::NPlusOne, Severity::High, 0.9))
            .collect();
        // distinct lines so dedupe keeps them all
        let mut node = mk_node("f", "a.rs");
        let mut findings = many;
        for (i, fnd) in findings.iter_mut().enumerate() {
            fnd.line = 100 + i;
        }
        node = with_findings(node, findings);
        let bar = QualityBar {
            per_category_cap: 3,
            ..QualityBar::default()
        };
        let sig = collect(&[node], &["a.rs".to_string()], &bar);
        assert_eq!(sig.findings.len(), 3, "per-category cap applied");
    }
}
