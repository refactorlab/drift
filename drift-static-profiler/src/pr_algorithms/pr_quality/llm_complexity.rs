//! pr_quality::llm_complexity — the flagship family.
//!
//! Treats "how hard is this PR for an LLM to review" as a first-class,
//! deterministic, citation-grounded quality dimension — something no
//! surveyed tool ships (PR_QUALITY_RESEARCH §6/§8.7; SWE-PRBench
//! arXiv:2603.26130 shows review quality degrades monotonically as
//! reviewed context grows). Five outputs:
//!
//! 1. **token_footprint** — `loc × 13` diff estimate (±20% band).
//! 2. **context_pressure** — GREEN/YELLOW/RED vs a 1M window × ~0.30 usable.
//! 3. **reviewability** — 0..1 = `1 − (w_t·tokens + w_c·coupling + w_f·files + w_d·dispersion)`.
//! 4. **semantic_density** — tokens / logical-units (dense vs boilerplate).
//! 5. **inversion** — the INVERSION flag: a *small* diff that touches a
//!    *foundational, state-bearing* node ⇒ "the diff size lies; budget
//!    extra review depth." Guarded against the central-but-trivial FP by
//!    `categories_reached` load-weighting.

use super::{clamp01, log1p_sat, smoothstep, tokens};
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::in_pr_changed_files;
use crate::pr_algorithms::symbol_label::display_symbol_label;
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::BTreeMap;

pub struct Inputs<'a> {
    /// Affected-roots forest (call trees that reach the changed code).
    pub entries: &'a [CallTreeNode],
    /// Changed files (diff LOC + file count).
    pub changed_files: &'a [ChangedFile],
    /// Number of PR-scoped findings (semantic-density logical unit).
    pub findings_count: usize,
    /// Total symbols in the graph — for `centrality_multiple = pagerank × N`.
    /// `0` = unknown → the inversion falls back to fan-in / subtree arms.
    pub total_symbols: usize,
}

/// Iterative DFS over the forest (returns every node once).
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

/// Category → load weight (how state-bearing the node is). The PRIMARY
/// false-positive discriminator for the inversion: a central *logging*
/// helper (weight 0.10) is suppressed; a central *db/queue* node (1.0) fires.
fn category_load_weight(cat: &str) -> f64 {
    let key = match cat {
        "db" => "inversion.load_db",
        "queue" => "inversion.load_queue",
        "network" => "inversion.load_network",
        "io" => "inversion.load_io",
        "cache" => "inversion.load_cache",
        "compute" => "inversion.load_compute",
        "log" => "inversion.load_log",
        _ => return 0.25, // unknown ≈ compute
    };
    pq_num(key)
}

pub fn compute(input: Inputs<'_>) -> LlmComplexity {
    let changed_paths: Vec<String> = input.changed_files.iter().map(|f| f.path.clone()).collect();
    let files_changed = input.changed_files.len();
    let diff_loc: usize = input
        .changed_files
        .iter()
        .map(|f| f.additions + f.deletions)
        .sum();

    // ── 1. token footprint (diff LOC × 13) ───────────────────────────
    let footprint = tokens::footprint_from_loc(diff_loc);
    let diff_tokens = footprint.estimate;

    // ── 2. context pressure ───────────────────────────────────────────
    let context = tokens::context_pressure(diff_tokens);

    // ── walk the changed nodes once (shared by 3/4/5) ─────────────────
    let changed: Vec<&CallTreeNode> = walk(input.entries)
        .into_iter()
        .filter(|n| in_pr_changed_files(&n.file, &changed_paths))
        .collect();
    let changed_fns = changed.len().max(1);
    let total_callees: usize = changed.iter().map(|n| n.callees_count).sum();
    let complexity_sum: usize = changed.iter().map(|n| n.complexity).sum();
    let distinct_categories: usize = {
        let mut set = std::collections::BTreeSet::new();
        for n in &changed {
            for k in n.categories_reached.keys() {
                set.insert(k.clone());
            }
        }
        set.len()
    };

    // ── 3. reviewability (1 − weighted penalty) ───────────────────────
    let p_tokens = clamp01(context.load); // >1 load → fully penalized
    let p_files = smoothstep(
        files_changed as f64,
        pq_num("llm.review_files_knee"),
        pq_num("llm.review_files_saturate"),
    );
    let p_coupling = clamp01(total_callees as f64 / pq_num("llm.review_coupling_saturate"));
    let p_dispersion = clamp01(files_changed as f64 / changed_fns as f64);
    let (w_t, w_c, w_f, w_d) = (
        pq_num("llm.review_w_tokens"),
        pq_num("llm.review_w_coupling"),
        pq_num("llm.review_w_files"),
        pq_num("llm.review_w_dispersion"),
    );
    let penalty = clamp01(w_t * p_tokens + w_c * p_coupling + w_f * p_files + w_d * p_dispersion);
    let reviewability_score = clamp01(1.0 - penalty);

    let reviewability = QualityDimension {
        score: reviewability_score,
        band: super::band_for(reviewability_score, true).to_string(),
        direction: if reviewability_score >= 0.5 {
            Direction::Up
        } else {
            Direction::Down
        },
        confidence: if files_changed == 0 {
            Confidence::Low
        } else {
            Confidence::Medium
        },
        components: vec![
            comp("token_fit", p_tokens, w_t, "diff token footprint vs usable context"),
            comp("cross_file_coupling", p_coupling, w_c, "outgoing edges from changed code"),
            comp("files_changed", p_files, w_f, "context-switching surface"),
            comp("dispersion", p_dispersion, w_d, "change scatter (files / functions)"),
        ],
        formula: "reviewability = 1 − (0.45·token_fit + 0.25·coupling + 0.20·files + 0.10·dispersion)"
            .into(),
        inputs: {
            let mut m = BTreeMap::new();
            m.insert("diff_tokens".into(), InputValue::Number(diff_tokens as f64));
            m.insert("files_changed".into(), InputValue::Number(files_changed as f64));
            m.insert("context_load".into(), InputValue::Number(round2(context.load)));
            m
        },
        kv: vec![],
        sources: vec![SourceCitation {
            label: "review degrades with context".into(),
            source: "SWE-PRBench: LLM review quality degrades monotonically as reviewed context grows".into(),
            source_link: "https://arxiv.org/abs/2603.26130".into(),
        }],
        notes: vec![],
    };

    // ── 4. semantic density (tokens / logical-units) ──────────────────
    let logical_units = (changed_fns + complexity_sum + input.findings_count + distinct_categories).max(1);
    let density = diff_tokens as f64 / logical_units as f64;
    let dense_max = pq_num("llm.semantic_density_dense_max");
    let boiler_min = pq_num("llm.semantic_density_boilerplate_min");
    let density_band = if density < dense_max {
        "dense"
    } else if density > boiler_min {
        "boilerplate"
    } else {
        "normal"
    };
    let semantic_density = SemanticDensity {
        value: round2(density),
        band: density_band.into(),
    };

    // ── 5. INVERSION flag ─────────────────────────────────────────────
    let inversion = detect_inversion(&changed, diff_tokens, files_changed, input.total_symbols);

    LlmComplexity {
        reviewability,
        token_footprint: footprint,
        context,
        semantic_density,
        inversion,
    }
}

/// The flagship: small diff × foundational, state-bearing node ⇒ flag.
fn detect_inversion(
    changed: &[&CallTreeNode],
    diff_tokens: usize,
    files_changed: usize,
    total_symbols: usize,
) -> InversionFlag {
    let small_tok = pq_num("inversion.small_diff_tokens");
    let small_files = pq_num("inversion.small_diff_files");
    let small_diff =
        (diff_tokens as f64) < small_tok && (files_changed as f64) <= small_files;
    if !small_diff {
        return InversionFlag::default();
    }
    // smallness: 1.0 at 0 tokens → 0.5 at the small-diff ceiling.
    let smallness = clamp01(1.0 - diff_tokens as f64 / (2.0 * small_tok));

    let hub_mult = pq_num("inversion.centrality_hub_mult");
    let fanin_hub = pq_num("inversion.fanin_hub");
    let subtree_hub = pq_num("inversion.subtree_hub");
    let load_floor = pq_num("inversion.load_floor");
    let clean_damp = pq_num("inversion.clean_node_damping");

    let mut best: Option<(f64, &CallTreeNode)> = None;
    for n in changed {
        let centrality_multiple = if total_symbols > 0 {
            n.pagerank * total_symbols as f64
        } else {
            0.0
        };
        let central = centrality_multiple >= hub_mult
            || n.call_site_count as f64 >= fanin_hub
            || n.subtree_size as f64 >= subtree_hub;
        if !central {
            continue;
        }
        // FP suppression: how state-bearing is this node? (db/queue=1.0 … log=0.10)
        let load_cat = n
            .categories_reached
            .keys()
            .map(|k| category_load_weight(k))
            .fold(0.0_f64, f64::max);
        let load_cat = if load_cat <= 0.0 { 0.25 } else { load_cat }; // no category ≈ compute
        let finding_factor = if n.findings.is_empty() { clean_damp } else { 1.0 };
        let load_bearing = clamp01(load_cat * finding_factor);
        if load_bearing < load_floor {
            continue; // central-but-trivial (e.g. a logging helper) → suppressed
        }
        let centrality = log1p_sat(centrality_multiple, hub_mult)
            .max(log1p_sat(n.call_site_count as f64, fanin_hub))
            .max(log1p_sat(n.subtree_size as f64, subtree_hub));
        let severity = clamp01(smallness * centrality * load_bearing);
        if best.map(|(s, _)| severity > s).unwrap_or(true) {
            best = Some((severity, n));
        }
    }

    match best {
        Some((severity, n)) => {
            let label = display_symbol_label(&n.name, n.parent_class.as_deref(), &n.file, n.line);
            let cats: Vec<&str> = n.categories_reached.keys().map(|s| s.as_str()).collect();
            InversionFlag {
                active: true,
                severity: round2(severity),
                symbol: label.clone(),
                detail: format!(
                    "Small diff ({diff_tokens} tok, {files_changed} file(s)) but `{label}` is foundational \
                     ({} callers, subtree {}, touches {}). Review depth ≠ diff size — budget extra review.",
                    n.call_site_count,
                    n.subtree_size,
                    if cats.is_empty() { "compute".into() } else { cats.join("/") },
                ),
            }
        }
        None => InversionFlag::default(),
    }
}

fn comp(key: &str, value: f64, weight: f64, detail: &str) -> QualityComponent {
    QualityComponent {
        key: key.into(),
        value: round2(value),
        weight,
        detail: detail.into(),
    }
}

fn round2(x: f64) -> f64 {
    let x = if x.is_finite() { x } else { 0.0 };
    (x * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_children};

    fn cf(path: &str, add: usize, del: usize) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some("modified".into()),
            additions: add,
            deletions: del,
            ..Default::default()
        }
    }

    #[test]
    fn small_clean_pr_has_high_reviewability_no_inversion() {
        let n = mk_node("helper", "src/a.rs");
        let r = compute(Inputs {
            entries: &[n],
            changed_files: &[cf("src/a.rs", 8, 2)],
            findings_count: 0,
            total_symbols: 100,
        });
        assert!(r.reviewability.score > 0.8, "small clean PR should be reviewable: {}", r.reviewability.score);
        assert_eq!(r.context.band, "green");
        assert!(!r.inversion.active);
    }

    #[test]
    fn huge_pr_is_red_and_low_reviewability() {
        // 20k changed LOC → ~260k tokens → RED context, low reviewability.
        let files: Vec<ChangedFile> = (0..60).map(|i| cf(&format!("src/f{i}.rs"), 200, 130)).collect();
        let entries: Vec<CallTreeNode> = (0..60).map(|i| mk_node(&format!("f{i}"), &format!("src/f{i}.rs"))).collect();
        let r = compute(Inputs {
            entries: &entries,
            changed_files: &files,
            findings_count: 5,
            total_symbols: 5000,
        });
        assert_eq!(r.context.band, "red");
        assert!(r.reviewability.score < 0.5, "huge tangled PR should score low: {}", r.reviewability.score);
    }

    /// The flagship: a tiny diff to a foundational, DB-bearing hub FIRES;
    /// the same tiny diff to a central-but-trivial logging helper does NOT.
    #[test]
    fn inversion_separates_core_abstraction_from_trivial_hub() {
        // Core txn node: high fan-in, touches db, has a finding.
        let mut core = mk_node("commit", "src/db/txn.rs");
        core.call_site_count = 64;
        core.subtree_size = 140;
        core.categories_reached.insert("db".into(), 8);
        // give it a finding so finding_factor = 1.0
        core.findings = vec![crate::insights::Finding {
            kind: crate::insights::FindingKind::NPlusOne,
            severity: crate::insights::Severity::High,
            effort: crate::insights::Effort::Medium,
            confidence: 0.9,
            line: 1,
            message: "m".into(),
            evidence: vec![],
            remediation: None,
            byte_range: None,
            fidelity: None,
            fusion_paths: vec![],
            predicted_sql: None,
            originating_orm: None,
        }];

        let core_pr = compute(Inputs {
            entries: &[core],
            changed_files: &[cf("src/db/txn.rs", 30, 8)],
            findings_count: 1,
            total_symbols: 1500,
        });
        assert!(core_pr.inversion.active, "core txn change must fire inversion");
        assert!(core_pr.inversion.severity > 0.3);

        // Logging helper: identical centrality shape, but log-only → suppressed.
        let mut logger = mk_node("log_debug", "src/log.rs");
        logger.call_site_count = 220;
        logger.subtree_size = 3;
        logger.categories_reached.insert("log".into(), 1);
        let log_pr = compute(Inputs {
            entries: &[logger],
            changed_files: &[cf("src/log.rs", 5, 0)],
            findings_count: 0,
            total_symbols: 1500,
        });
        assert!(!log_pr.inversion.active, "central-but-trivial logger must NOT fire inversion");
    }

    #[test]
    fn semantic_density_bands() {
        // Few logical units, many tokens → boilerplate.
        let n = with_children(mk_node("gen", "g.rs"), vec![]);
        let r = compute(Inputs {
            entries: &[n],
            changed_files: &[cf("g.rs", 2000, 0)], // ~26k tokens, 1 fn
            findings_count: 0,
            total_symbols: 10,
        });
        assert_eq!(r.semantic_density.band, "boilerplate");
    }

    #[test]
    fn outputs_are_finite_for_empty_pr() {
        let r = compute(Inputs {
            entries: &[],
            changed_files: &[],
            findings_count: 0,
            total_symbols: 0,
        });
        assert!(r.reviewability.score.is_finite());
        assert!(r.context.load.is_finite());
        assert!(r.semantic_density.value.is_finite());
        assert!(!r.inversion.active);
    }
}
