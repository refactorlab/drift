//! pr_quality::correctness_confidence — how sure are we it's right?
//!
//! Three sub-signals combined by a weighted **geometric mean** (weakest-link:
//! great branch coverage can't paper over zero test reachability —
//! PR_QUALITY_RESEARCH §6/§8.6):
//! - **coverage** (0.45) — STATIC reachability proxy `(affected − uncovered)
//!   / affected × test-presence`. NOT executed coverage (over/under-approximates),
//!   so confidence is capped Medium unless a real patch-% is supplied.
//! - **repeatability** (0.30) — idempotency/determinism penalty model:
//!   non-idempotent writes (INSERT/POST), worse `in_loop` (AWS retry hazard),
//!   non-determinism (now/random/uuid), relieved by idempotency markers (RFC 9110 + AWS).
//! - **edge-case surface** (0.25) — noisy-OR of param-count (S107) and branch
//!   count (McCabe = test-case upper bound), discounted by input-validation markers.

use super::{band_for, clamp01};
use crate::categories::Category;
use crate::graph::ExternalCall;
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::in_pr_changed_files;
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use regex::Regex;
use std::collections::BTreeMap;
use std::sync::OnceLock;

pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    pub changed_files: &'a [ChangedFile],
    /// Affected entrypoint roots (coverage denominator).
    pub affected_roots: usize,
    /// Roots with no test reaching them (`tests_in_graph::uncovered_roots`).
    pub uncovered_roots: usize,
    /// New test files added in the PR.
    pub new_test_files: usize,
    /// Optional REAL patch/diff-coverage % (0..1) from CI (Codecov/Sonar).
    /// When present, overrides the static proxy AND lifts the Medium cap.
    pub external_coverage: Option<f64>,
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

fn non_idempotent_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)\b(insert|create|post|send|publish|emit|enqueue|append|charge|incr|increment)\b")
            .unwrap()
    })
}
fn idempotent_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)\b(update|put|upsert|merge|set|replace|delete|remove|save)\b").unwrap())
}
fn nondeterminism_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)\b(now|today|random|rand|uuid|guid|currenttime|systemtime|datetime)\b").unwrap())
}
fn idempotency_marker_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)(idempot|dedup|client_?token|exactly_?once)").unwrap())
}
fn retry_marker_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)\b(retry|circuit|fallback|backoff)\b").unwrap())
}
fn input_safety_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)(validate|sanitize|schema|escape|normalize)").unwrap())
}

/// Penalty for a single external call (0 = pure/none).
fn call_penalty(e: &ExternalCall) -> f64 {
    let effectful = matches!(
        e.category,
        Category::Db | Category::Io | Category::Network | Category::Queue | Category::Cache
    );
    if !effectful {
        return 0.0;
    }
    let name = e.name.to_lowercase();
    let sql = e
        .sql_literal
        .as_deref()
        .unwrap_or("")
        .trim_start()
        .to_uppercase();
    let mut p = if sql.starts_with("INSERT") || sql.starts_with("REPLACE INTO") {
        pq_num("correctness.repeat_write_non_idempotent")
    } else if sql.starts_with("UPDATE") || sql.starts_with("DELETE") || sql.starts_with("MERGE")
        || sql.starts_with("UPSERT")
    {
        pq_num("correctness.repeat_write_idempotent")
    } else if non_idempotent_re().is_match(&name) {
        pq_num("correctness.repeat_write_non_idempotent")
    } else if idempotent_re().is_match(&name) {
        pq_num("correctness.repeat_write_idempotent")
    } else {
        pq_num("correctness.repeat_read_effectful")
    };
    let is_write = p >= pq_num("correctness.repeat_write_non_idempotent");
    if e.in_loop && is_write {
        p += pq_num("correctness.repeat_in_loop_amp");
    }
    if e.in_await {
        p += pq_num("correctness.repeat_in_await_amp");
    }
    clamp01(p)
}

fn node_text(n: &CallTreeNode) -> String {
    let mut s = n.name.to_lowercase();
    for e in &n.external_calls {
        s.push(' ');
        s.push_str(&e.name.to_lowercase());
        if let Some(r) = &e.receiver {
            s.push(' ');
            s.push_str(&r.to_lowercase());
        }
    }
    s
}

/// Per-node repeatability ∈ [0,1] (1 = deterministic/idempotent).
fn repeatability_node(n: &CallTreeNode) -> (f64, bool) {
    let effect = n.external_calls.iter().map(call_penalty).fold(0.0_f64, f64::max);
    let effectful = effect > 0.0 || n.categories_reached.keys().any(|k| {
        matches!(k.as_str(), "db" | "network" | "io" | "queue" | "cache")
    });
    let text = node_text(n);
    let nondet = if nondeterminism_re().is_match(&text) {
        pq_num("correctness.repeat_non_determinism")
    } else {
        0.0
    };
    let raw = clamp01(effect + nondet);
    let relief = if idempotency_marker_re().is_match(&text) {
        pq_num("correctness.repeat_relief_strong")
    } else if retry_marker_re().is_match(&text) {
        pq_num("correctness.repeat_relief_weak")
    } else {
        1.0
    };
    (clamp01(1.0 - raw * relief), effectful || nondet > 0.0)
}

/// Per-node edge-case surface goodness ∈ [0,1] (1 = small, validated surface).
fn edge_node(n: &CallTreeNode) -> f64 {
    let free = pq_num("correctness.params_free");
    let many = pq_num("correctness.params_too_many");
    let param_surface = clamp01((n.parameter_count as f64 - free) / (many - free).max(1.0));
    let cmax = pq_num("correctness.complexity_saturation");
    let branch_surface = clamp01((n.complexity as f64 - 1.0) / (cmax - 1.0).max(1.0));
    let raw = 1.0 - (1.0 - param_surface) * (1.0 - branch_surface);
    let discount = if input_safety_re().is_match(&node_text(n)) {
        pq_num("correctness.input_safety_discount")
    } else {
        1.0
    };
    clamp01(1.0 - clamp01(raw * discount))
}

pub fn compute(input: Inputs<'_>) -> QualityDimension {
    let changed_paths: Vec<String> = input.changed_files.iter().map(|f| f.path.clone()).collect();
    let added: usize = input.changed_files.iter().map(|f| f.additions).sum();
    let changed: Vec<&CallTreeNode> = walk(input.entries)
        .into_iter()
        .filter(|n| in_pr_changed_files(&n.file, &changed_paths))
        .collect();

    // ── coverage (static reachability proxy, or external %) ───────────
    let proxy_only = input.external_coverage.is_none();
    let coverage = match input.external_coverage {
        Some(ext) => clamp01(ext),
        None => {
            let reach = if input.affected_roots > 0 {
                clamp01(
                    (input.affected_roots.saturating_sub(input.uncovered_roots)) as f64
                        / input.affected_roots as f64,
                )
            } else {
                1.0 // no roots → nothing to cover (low confidence handles this)
            };
            let tpf = if input.new_test_files > 0 {
                1.0
            } else {
                pq_num("correctness.test_presence_factor_no_new")
            };
            let base = clamp01(reach * tpf);
            if (added as f64) < pq_num("correctness.diff_coverage_min_lines") {
                base.max(0.8) // small-diff waiver (SonarQube 20-line rule)
            } else {
                base
            }
        }
    };

    // ── repeatability + edge (pagerank-weighted means) ────────────────
    let (mut rw, mut rs, mut ew, mut es) = (0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64);
    let mut any_effectful = false;
    for n in &changed {
        let w = n.pagerank.max(1e-6); // floor so a 0-pagerank node still counts
        let (rep, effectful) = repeatability_node(n);
        if effectful {
            any_effectful = true;
            rw += w;
            rs += w * rep;
        }
        ew += w;
        es += w * edge_node(n);
    }
    let repeatability = if any_effectful && rw > 0.0 {
        clamp01(rs / rw)
    } else {
        1.0 // no effectful changed code → trivially repeatable
    };
    let edge = if ew > 0.0 { clamp01(es / ew) } else { 1.0 };

    // ── weighted GEOMETRIC mean (weakest-link) ────────────────────────
    let (wc, wr, we) = (
        pq_num("correctness.w_coverage"),
        pq_num("correctness.w_repeatability"),
        pq_num("correctness.w_edge"),
    );
    let eps = 0.01_f64;
    let score = clamp01(
        (wc * coverage.max(eps).ln() + wr * repeatability.max(eps).ln() + we * edge.max(eps).ln()).exp(),
    );

    // ── confidence: proxy-only ⇒ cap Medium; tiny root set ⇒ Low ──────
    let mut confidence = if proxy_only {
        Confidence::Medium
    } else {
        Confidence::High
    };
    if input.affected_roots < 3 && proxy_only {
        confidence = Confidence::Low;
    }

    let mut notes = vec![];
    if proxy_only {
        notes.push(
            "Coverage is a STATIC reachability proxy, not executed coverage (over/under-approximates). \
             Supply a real patch-coverage % to lift confidence."
                .to_string(),
        );
    }

    QualityDimension {
        score,
        band: band_for(score, true).to_string(),
        direction: if score >= 0.5 { Direction::Up } else { Direction::Down },
        confidence,
        components: vec![
            comp("coverage", coverage, wc, if proxy_only { "static test-reachability of changed roots" } else { "external patch coverage" }),
            comp("repeatability", repeatability, wr, "idempotency/determinism of side effects"),
            comp("edge_case_surface", edge, we, "input-assumption surface (params + branches)"),
        ],
        formula: "geometric mean: coverage^0.45 · repeatability^0.30 · edge^0.25 (weakest-link)".into(),
        inputs: {
            let mut m = BTreeMap::new();
            m.insert("affected_roots".into(), InputValue::Number(input.affected_roots as f64));
            m.insert("uncovered_roots".into(), InputValue::Number(input.uncovered_roots as f64));
            m.insert("new_test_files".into(), InputValue::Number(input.new_test_files as f64));
            m.insert("coverage_is_proxy".into(), InputValue::Bool(proxy_only));
            m
        },
        kv: vec![],
        sources: vec![
            SourceCitation {
                label: "coverage gate".into(),
                source: "SonarQube Coverage-on-New-Code (80%) — static reachability is a proxy".into(),
                source_link: "https://docs.sonarsource.com/sonarqube-server/user-guide/code-metrics/metrics-definition".into(),
            },
            SourceCitation {
                label: "idempotency".into(),
                source: "AWS making-retries-safe + RFC 9110 method idempotency".into(),
                source_link: "https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/".into(),
            },
        ],
        notes,
    }
}

fn comp(key: &str, value: f64, weight: f64, detail: &str) -> QualityComponent {
    QualityComponent {
        key: key.into(),
        value: (value * 100.0).round() / 100.0,
        weight,
        detail: detail.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_externals};

    fn cf(path: &str, add: usize) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some("modified".into()),
            additions: add,
            deletions: 0,
            ..Default::default()
        }
    }

    fn db_call(name: &str, in_loop: bool, sql: Option<&str>) -> CallTreeNode {
        let mut n = with_externals(mk_node("handler", "src/h.rs"), vec![name]);
        n.external_calls[0].category = Category::Db;
        n.external_calls[0].in_loop = in_loop;
        n.external_calls[0].sql_literal = sql.map(|s| s.to_string());
        n.categories_reached.insert("db".into(), 1);
        n
    }

    #[test]
    fn pure_compute_is_perfectly_repeatable() {
        let n = mk_node("add", "m.rs");
        let (rep, effectful) = repeatability_node(&n);
        assert_eq!(rep, 1.0);
        assert!(!effectful);
    }

    #[test]
    fn loop_insert_without_marker_is_low_repeatability() {
        let n = db_call("insert", true, Some("INSERT INTO t VALUES (1)"));
        let (rep, _) = repeatability_node(&n);
        assert!(rep < 0.1, "loop INSERT no idempotency marker → ~0, got {rep}");
    }

    #[test]
    fn idempotency_marker_rescues_loop_insert() {
        let mut n = db_call("insert_idempotent", true, Some("INSERT INTO t VALUES (1)"));
        n.name = "insert_with_client_token".into(); // marker in the name
        let (rep, _) = repeatability_node(&n);
        assert!(rep > 0.5, "idempotency marker should rescue, got {rep}");
    }

    #[test]
    fn edge_surface_drops_with_params_and_complexity_then_validation_helps() {
        let mut wide = mk_node("build", "m.rs");
        wide.parameter_count = 8;
        wide.complexity = 12;
        let bad = edge_node(&wide);
        assert!(bad < 0.3, "8 params + complexity 12 → high surface, got {bad}");
        let mut validated = wide.clone();
        validated.name = "build_validated".into(); // input-safety marker
        assert!(edge_node(&validated) > bad, "validation marker should reduce surface");
    }

    #[test]
    fn geometric_mean_is_weakest_link() {
        // Zero coverage (no new tests, all roots uncovered, big diff) drags
        // the score down even with clean repeatability/edge.
        let n = mk_node("f", "src/f.rs");
        let r = compute(Inputs {
            entries: &[n],
            changed_files: &[cf("src/f.rs", 500)],
            affected_roots: 4,
            uncovered_roots: 4, // 0% reachable
            new_test_files: 0,
            external_coverage: None,
        });
        assert!(r.score < 0.4, "zero coverage must drag geometric mean down, got {}", r.score);
        assert_eq!(r.confidence, Confidence::Medium); // proxy-only cap
    }

    #[test]
    fn external_coverage_overrides_and_lifts_confidence() {
        let n = mk_node("f", "src/f.rs");
        let r = compute(Inputs {
            entries: &[n],
            changed_files: &[cf("src/f.rs", 500)],
            affected_roots: 4,
            uncovered_roots: 4,
            new_test_files: 0,
            external_coverage: Some(0.95),
        });
        assert_eq!(r.confidence, Confidence::High);
        assert!(r.score > 0.5, "real 95% coverage should lift the score, got {}", r.score);
    }

    #[test]
    fn finite_and_bounded_on_empty() {
        let r = compute(Inputs {
            entries: &[],
            changed_files: &[],
            affected_roots: 0,
            uncovered_roots: 0,
            new_test_files: 0,
            external_coverage: None,
        });
        assert!(r.score.is_finite() && (0.0..=1.0).contains(&r.score));
    }
}
