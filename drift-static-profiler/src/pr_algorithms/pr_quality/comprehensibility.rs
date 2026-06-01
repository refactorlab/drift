//! pr_quality::comprehensibility — can an unfamiliar engineer understand
//! this change without asking? (higher = easier)
//!
//! Weighted mean of three sub-signals (PR_QUALITY_RESEARCH §1/§8):
//! - **explainability** (0.45) — control-flow + comment density + naming.
//! - **decision_transparency** (0.30) — magic-number density + rationale
//!   (Conventional-Commit narrative) − TODO penalty.
//! - **context_dependency** (0.25, inverted to ease) — coupling/centrality:
//!   touching a core abstraction needs more prior knowledge to review.
//!
//! NOTE: the control-flow term uses `complexity + nesting_depth` as a
//! *cognitive-complexity surrogate* (capped so its known upward bias on
//! flat dispatch tables can't dominate). Computing TRUE Campbell cognitive
//! complexity in `metrics.rs` is the noted follow-up (PR_QUALITY_RESEARCH §8.3).

use super::{band_for, clamp01, source_scan};
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::in_pr_changed_files;
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use heck::ToSnakeCase;
use std::collections::BTreeMap;
use std::path::Path;

pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    pub changed_files: &'a [ChangedFile],
    pub commit_messages: &'a [String],
    pub repo_root: Option<&'a Path>,
    pub total_symbols: usize,
}

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

/// A name is "clear" iff it splits into ≥1 word-like token of length
/// ≥ `min_len` (Lawrie: full words ⇒ better comprehension). Synthetic
/// names (`<module>` / `<anonymous@N>`) are not penalized.
fn name_is_clear(name: &str, min_len: usize) -> bool {
    if name.starts_with('<') {
        return true;
    }
    if name.chars().count() <= 1 {
        return false;
    }
    let snake = name.to_snake_case();
    snake
        .split('_')
        .filter(|w| !w.is_empty())
        .any(|w| w.chars().count() >= min_len)
}

pub fn compute(input: Inputs<'_>) -> QualityDimension {
    let changed_paths: Vec<String> = input.changed_files.iter().map(|f| f.path.clone()).collect();
    let changed: Vec<&CallTreeNode> = walk(input.entries)
        .into_iter()
        .filter(|n| in_pr_changed_files(&n.file, &changed_paths))
        .collect();
    let n_fns = changed.len().max(1) as f64;

    // ── source-text aggregate (comment density + magic numbers) ───────
    let mut text = source_scan::FileTextStats::default();
    let mut scanned_any = false;
    for f in input.changed_files {
        if let Some(s) = source_scan::scan_file(input.repo_root, &f.path) {
            text.add(&s);
            scanned_any = true;
        }
    }

    // ── explainability (control-flow + comments + naming) ─────────────
    let cog_limit = pq_num("comprehensibility.cognitive_complexity_limit");
    let flow: f64 = changed
        .iter()
        .map(|n| {
            let cog = (n.complexity + n.nesting_depth) as f64; // surrogate, capped below
            clamp01(1.0 - (cog - 1.0) / (cog_limit - 1.0).max(1.0))
        })
        .sum::<f64>()
        / n_fns;

    let target = pq_num("comprehensibility.comment_density_target");
    let high = pq_num("comprehensibility.comment_density_high");
    let cd = text.comment_density();
    let cd_score = if !scanned_any {
        0.5 // unknown → neutral
    } else if cd <= 0.0 {
        0.3
    } else if cd < target {
        clamp01(0.3 + 0.7 * (cd / target))
    } else if cd <= high {
        1.0
    } else {
        clamp01(1.0 - (cd - high))
    };

    let min_word = pq_num("comprehensibility.identifier_min_word_len") as usize;
    let naming = if changed.is_empty() {
        1.0
    } else {
        changed.iter().filter(|n| name_is_clear(&n.name, min_word)).count() as f64 / n_fns
    };

    let explain = clamp01(0.45 * flow + 0.30 * cd_score + 0.25 * naming);

    // ── decision transparency (magic numbers + rationale − TODO) ──────
    let magic_score = clamp01(1.0 - text.magic_ratio() / pq_num("comprehensibility.magic_ratio_budget"));
    let has_narrative = input.commit_messages.iter().any(|m| {
        let l = m.lines().next().unwrap_or("").to_lowercase();
        ["feat:", "fix:", "perf:", "refactor:", "docs:"].iter().any(|p| l.starts_with(p))
    });
    let narrative = if has_narrative { 1.0 } else { 0.4 };
    let todo_penalty = clamp01(text.todo_markers as f64 / n_fns).min(0.3);
    let transparency = clamp01(0.5 * magic_score + 0.5 * narrative - todo_penalty);

    // ── context dependency (coupling/centrality), inverted to ease ────
    let fanin_core = pq_num("comprehensibility.context_fanin_core");
    let subtree_broad = pq_num("comprehensibility.context_subtree_broad");
    let max_pr = changed.iter().map(|n| n.pagerank).fold(0.0_f64, f64::max).max(1e-9);
    let ctx_cost: f64 = changed
        .iter()
        .map(|n| {
            let pr_norm = clamp01(n.pagerank / max_pr);
            let fanin_norm = clamp01(n.call_site_count as f64 / fanin_core);
            let fanout_norm = clamp01((n.callees_count + n.subtree_size) as f64 / subtree_broad);
            let domains = clamp01(n.categories_reached.len() as f64 / 7.0);
            clamp01(0.40 * pr_norm + 0.30 * fanin_norm + 0.20 * fanout_norm + 0.10 * domains)
        })
        .sum::<f64>()
        / n_fns;
    let context_ease = clamp01(1.0 - ctx_cost);

    // ── compose ───────────────────────────────────────────────────────
    let (we, wt, wc) = (
        pq_num("comprehensibility.w_explain"),
        pq_num("comprehensibility.w_transparency"),
        pq_num("comprehensibility.w_context"),
    );
    let score = clamp01(we * explain + wt * transparency + wc * context_ease);

    let mut notes = vec![
        "Control-flow term uses a complexity+nesting cognitive surrogate (capped); \
         true cognitive complexity is a planned upgrade."
            .to_string(),
    ];
    if !scanned_any {
        notes.push("Comment/magic-number terms used neutral defaults (source text unavailable).".into());
    }

    QualityDimension {
        score,
        band: band_for(score, true).to_string(),
        direction: if score >= 0.5 { Direction::Up } else { Direction::Down },
        confidence: if scanned_any { Confidence::Medium } else { Confidence::Low },
        components: vec![
            comp("explainability", explain, we, "control-flow + comment density + naming"),
            comp("decision_transparency", transparency, wt, "magic numbers + rationale − TODO"),
            comp("context_dependency", context_ease, wc, "ease = 1 − coupling/centrality cost"),
        ],
        formula: "comprehensibility = 0.45·explainability + 0.30·transparency + 0.25·context_ease".into(),
        inputs: {
            let mut m = BTreeMap::new();
            m.insert("comment_density".into(), InputValue::Number(round2(cd)));
            m.insert("magic_ratio".into(), InputValue::Number(round2(text.magic_ratio())));
            m.insert("naming_clear_fraction".into(), InputValue::Number(round2(naming)));
            m.insert("has_commit_narrative".into(), InputValue::Bool(has_narrative));
            m
        },
        kv: vec![],
        sources: vec![SourceCitation {
            label: "understandability".into(),
            source: "Bacchelli & Bird (review challenge) + SonarQube Cognitive Complexity + Lawrie naming"
                .into(),
            source_link: "https://www.sonarsource.com/resources/cognitive-complexity/".into(),
        }],
        notes,
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
    use crate::pr_algorithms::test_helpers::{mk_node, with_complexity};

    fn cf(path: &str) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some("modified".into()),
            additions: 20,
            deletions: 0,
            ..Default::default()
        }
    }

    #[test]
    fn naming_clarity() {
        assert!(name_is_clear("getUserById", 3));
        assert!(name_is_clear("create_order", 3));
        assert!(name_is_clear("HTMLParser", 3));
        assert!(!name_is_clear("x", 3));
        assert!(!name_is_clear("a1", 3)); // no 3-char word
        assert!(name_is_clear("<module>", 3)); // synthetic not penalized
    }

    #[test]
    fn simple_well_named_low_complexity_is_comprehensible() {
        let n = with_complexity(mk_node("create_user", "src/users.rs"), 2);
        let r = compute(Inputs {
            entries: &[n],
            changed_files: &[cf("src/users.rs")],
            commit_messages: &["feat: add user creation".into()],
            repo_root: None,
            total_symbols: 100,
        });
        assert!(r.score > 0.55, "simple well-named fn should be comprehensible: {}", r.score);
    }

    #[test]
    fn high_complexity_lowers_comprehensibility() {
        let simple = with_complexity(mk_node("f", "a.rs"), 2);
        let gnarly = with_complexity(mk_node("f", "a.rs"), 30);
        let mk = |n| compute(Inputs {
            entries: std::slice::from_ref(&n),
            changed_files: &[cf("a.rs")],
            commit_messages: &[],
            repo_root: None,
            total_symbols: 0,
        }).score;
        assert!(mk(gnarly) < mk(simple), "high complexity should lower comprehensibility");
    }

    #[test]
    fn finite_and_bounded_on_empty() {
        let r = compute(Inputs {
            entries: &[],
            changed_files: &[],
            commit_messages: &[],
            repo_root: None,
            total_symbols: 0,
        });
        assert!(r.score.is_finite() && (0.0..=1.0).contains(&r.score));
    }
}
