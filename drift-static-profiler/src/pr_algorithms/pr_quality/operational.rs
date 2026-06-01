//! pr_quality::operational — operational RISK (higher = riskier).
//!
//! Three SRE/DORA-grounded sub-signals, combined `max`-style so one
//! irreversible step dominates (PR_QUALITY_RESEARCH §5/§8.5):
//!
//! - **rollback** — how hard is the revert? Driven by `MIG_*`
//!   migration-safety findings (destructive vs blocking DDL), DB writes,
//!   and removed/renamed files. `max` of the evidence, not a sum.
//! - **blast radius** — entrypoint reach + call-graph centrality
//!   (SRE gradual-rollout cohort basis).
//! - **observability** — blind-spot ratio: I/O-bearing roots emitting no
//!   Log-category call (you can't safely roll out what you can't observe).
//!
//! Floor: a destructive migration pins the dimension ≥ 0.80 regardless of
//! blast/observability (strong_migrations: irreversible DDL is
//! categorically high-risk). Advisory — never gates.

use super::{band_for, clamp01, log1p_sat};
use crate::categories::Category;
use crate::insights::FindingKind;
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::pr_signals::PrSignals;
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::BTreeMap;

pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    pub changed_files: &'a [ChangedFile],
    pub signals: &'a PrSignals,
    /// Number of affected entrypoint roots (≈ user-facing surfaces).
    pub affected_roots: usize,
    /// Graph N for `centrality_multiple = pagerank × N` (0 = unknown).
    pub total_symbols: usize,
}

/// Destructive/irreversible DDL rule ids (strong_migrations): a code
/// revert cannot restore dropped data / rewritten columns.
fn is_destructive_ddl(rule_id: &str) -> bool {
    matches!(
        rule_id,
        "MIG_DROP_TABLE" | "MIG_DROP_COLUMN" | "MIG_ALTER_COLUMN_TYPE"
    )
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

/// Does any node in this root's subtree emit a Log-category external
/// call (the structural observability signal, more precise than a
/// keyword scan per PR_QUALITY_RESEARCH §8.5)?
fn root_is_observable(root: &CallTreeNode) -> bool {
    walk(std::slice::from_ref(root))
        .iter()
        .any(|n| n.external_calls.iter().any(|e| e.category == Category::Log))
}

fn root_does_io(root: &CallTreeNode) -> bool {
    walk(std::slice::from_ref(root)).iter().any(|n| {
        n.categories_reached.keys().any(|k| {
            matches!(k.as_str(), "db" | "network" | "io" | "queue" | "cache")
        })
    })
}

pub fn compute(input: Inputs<'_>) -> QualityDimension {
    // ── rollback (max-of-evidence) ────────────────────────────────────
    let mut destructive = false;
    let mut blocking = false;
    for f in &input.signals.findings {
        if f.kind == FindingKind::MigrationSafety {
            if is_destructive_ddl(&f.rule_id) {
                destructive = true;
            } else {
                blocking = true;
            }
        }
    }
    let any_migration = destructive || blocking;
    let removed_renamed = input.changed_files.iter().any(|f| {
        matches!(f.status.as_deref(), Some("removed") | Some("renamed")) || f.old_path.is_some()
    });
    let db_write = input.signals.touches_db;

    let rollback = [
        pq_num("operational.rollback_destructive_ddl_w") * destructive as i32 as f64,
        pq_num("operational.rollback_blocking_ddl_w") * blocking as i32 as f64,
        pq_num("operational.rollback_removed_renamed_w") * removed_renamed as i32 as f64,
        pq_num("operational.rollback_db_write_no_ddl_w")
            * (db_write && !any_migration) as i32 as f64,
    ]
    .into_iter()
    .fold(0.0_f64, f64::max);

    // ── blast radius ──────────────────────────────────────────────────
    let nodes = walk(input.entries);
    let roots_term = clamp01(input.affected_roots as f64 / pq_num("operational.blast_wide_roots"));
    let max_percent = nodes
        .iter()
        .map(|n| clamp01(n.percent_total / 100.0))
        .fold(0.0_f64, f64::max);
    let max_fanin = nodes.iter().map(|n| n.call_site_count).max().unwrap_or(0);
    let fanin_term = log1p_sat(max_fanin as f64, pq_num("inversion.fanin_hub"));
    let centrality_term = if input.total_symbols > 0 {
        let max_mult = nodes
            .iter()
            .map(|n| n.pagerank * input.total_symbols as f64)
            .fold(0.0_f64, f64::max);
        log1p_sat(max_mult, pq_num("inversion.centrality_hub_mult"))
    } else {
        max_percent
    };
    let blast = clamp01(
        pq_num("operational.blast_w_roots") * roots_term
            + pq_num("operational.blast_w_centrality") * centrality_term
            + pq_num("operational.blast_w_percent") * max_percent
            + pq_num("operational.blast_w_fanin") * fanin_term,
    );

    // ── observability blind-spot ──────────────────────────────────────
    let io_roots: Vec<&CallTreeNode> = input.entries.iter().filter(|r| root_does_io(r)).collect();
    let observability = if io_roots.is_empty() {
        // No I/O-bearing path → little to observe; halve any residual.
        0.0
    } else {
        let blind = io_roots.iter().filter(|r| !root_is_observable(r)).count();
        clamp01(blind as f64 / io_roots.len() as f64)
    };

    // ── compose (weighted) then non-compensatory destructive floor ────
    let mut score = clamp01(
        pq_num("operational.risk_w_rollback") * rollback
            + pq_num("operational.risk_w_blast") * blast
            + pq_num("operational.risk_w_observability") * observability,
    );
    if destructive {
        score = score.max(pq_num("operational.destructive_floor"));
    }

    let mut notes = vec![
        "Higher = riskier. Advisory — does not gate the merge.".to_string(),
    ];
    if destructive {
        notes.push("Destructive/irreversible migration detected — revert cannot restore data.".into());
    }

    QualityDimension {
        score,
        band: band_for(score, false).to_string(), // higher = worse
        direction: Direction::Down,
        confidence: if any_migration || db_write {
            Confidence::Medium
        } else {
            Confidence::Low
        },
        components: vec![
            comp("rollback", rollback, pq_num("operational.risk_w_rollback"), "revert difficulty (migrations, removed files)"),
            comp("blast_radius", blast, pq_num("operational.risk_w_blast"), "entrypoint reach + centrality"),
            comp("observability", observability, pq_num("operational.risk_w_observability"), "I/O roots with no logging (blind spots)"),
        ],
        formula: "risk = 0.45·rollback + 0.35·blast + 0.20·observability; floor 0.80 on destructive DDL"
            .into(),
        inputs: {
            let mut m = BTreeMap::new();
            m.insert("destructive_migration".into(), InputValue::Bool(destructive));
            m.insert("blocking_migration".into(), InputValue::Bool(blocking));
            m.insert("removed_or_renamed_files".into(), InputValue::Bool(removed_renamed));
            m.insert("affected_roots".into(), InputValue::Number(input.affected_roots as f64));
            m
        },
        kv: vec![],
        sources: vec![
            SourceCitation {
                label: "rollback".into(),
                source: "strong_migrations / squawk (irreversible vs blocking DDL)".into(),
                source_link: "https://github.com/ankane/strong_migrations".into(),
            },
            SourceCitation {
                label: "blast radius".into(),
                source: "Google SRE — gradual rollout cohorts".into(),
                source_link: "https://sre.google/sre-book/reliable-product-launches/".into(),
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
    use crate::insights::{Effort, Finding, Severity};
    use crate::pr_algorithms::pr_signals::{collect, QualityBar};
    use crate::pr_algorithms::test_helpers::{mk_node, with_externals, with_findings};

    fn cf(path: &str, status: &str) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some(status.into()),
            additions: 5,
            deletions: 1,
            ..Default::default()
        }
    }

    fn mig_finding(rule_id: &str) -> Finding {
        Finding {
            kind: FindingKind::MigrationSafety,
            severity: Severity::High,
            effort: Effort::Medium,
            confidence: 0.9,
            line: 1,
            message: "migration hazard".into(),
            evidence: vec![crate::insights::Evidence {
                call: rule_id.into(),
                line: 1,
                category: None,
            }],
            remediation: None,
            byte_range: None,
            fidelity: None,
            fusion_paths: vec![],
            predicted_sql: None,
            originating_orm: None,
        }
    }

    #[test]
    fn destructive_migration_floors_at_080() {
        let node = with_findings(mk_node("migrate", "db/migrations/001.sql"), vec![mig_finding("MIG_DROP_COLUMN")]);
        let sig = collect(&[node.clone()], &["db/migrations/001.sql".into()], &QualityBar::default());
        let r = compute(Inputs {
            entries: &[node],
            changed_files: &[cf("db/migrations/001.sql", "modified")],
            signals: &sig,
            affected_roots: 1,
            total_symbols: 100,
        });
        assert!(r.score >= 0.80, "destructive DDL must floor ≥0.80, got {}", r.score);
        assert_eq!(r.direction, Direction::Down);
        assert_eq!(r.band, "red");
    }

    #[test]
    fn clean_pure_compute_pr_is_low_risk() {
        let node = mk_node("calc", "src/math.rs");
        let sig = PrSignals::default();
        let r = compute(Inputs {
            entries: &[node],
            changed_files: &[cf("src/math.rs", "modified")],
            signals: &sig,
            affected_roots: 1,
            total_symbols: 100,
        });
        assert!(r.score < 0.3, "clean compute PR should be low risk, got {}", r.score);
    }

    #[test]
    fn io_root_without_logging_raises_observability_risk() {
        // A root that hits the DB but emits no Log call = a blind spot.
        let mut db_node = with_externals(mk_node("handler", "src/h.rs"), vec!["query"]);
        db_node.external_calls[0].category = Category::Db;
        db_node.categories_reached.insert("db".into(), 1);
        let sig = PrSignals::default();
        let r = compute(Inputs {
            entries: &[db_node],
            changed_files: &[cf("src/h.rs", "modified")],
            signals: &sig,
            affected_roots: 1,
            total_symbols: 100,
        });
        let obs = r.components.iter().find(|c| c.key == "observability").unwrap();
        assert!(obs.value > 0.0, "DB root with no logging should flag observability");
    }

    #[test]
    fn score_is_finite_on_empty() {
        let r = compute(Inputs {
            entries: &[],
            changed_files: &[],
            signals: &PrSignals::default(),
            affected_roots: 0,
            total_symbols: 0,
        });
        assert!(r.score.is_finite());
        assert!(r.score >= 0.0 && r.score <= 1.0);
    }
}
