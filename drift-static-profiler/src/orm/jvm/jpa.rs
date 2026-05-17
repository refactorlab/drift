//! JPA / Hibernate / Spring Data — rules + dialect.
//!
//! Phase 3 v1 rules:
//! - `JPA-N1-001` — `repo.findById(id)` inside a loop / stream forEach
//! - `JPA-QRY-002` — `@Query("...WHERE name = '" + name + "'...")` string concat injection
//! - `JPA-EAGER-003` — `@ManyToOne(fetch = FetchType.EAGER)` (default is EAGER but explicit is worse — global)
//! - `JPA-SAVE-004` — `repo.save(entity)` inside a loop (use `saveAll`)

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::dialect::OrmDialect;
use crate::orm::sql_ir::{
    OrmKind, PredictedSql, PredictedStatement, Projection, SqlDialect, SqlFidelity, SqlOp,
    TableRef, WhereExpr,
};
use crate::orm::{Framework, MatchHit, OrmRule};

fn hit(chain: &CallChain, note: &str) -> MatchHit {
    MatchHit {
        line: chain.steps.last().map(|s| s.line).unwrap_or(1),
        byte_range: chain.byte_range.clone(),
        extra_evidence: vec![Evidence {
            call: note.to_string(),
            line: chain.steps.last().map(|s| s.line).unwrap_or(1),
            category: None,
        }],
    }
}

fn looks_like_repo(chain: &CallChain) -> bool {
    let root_text = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => return false,
    };
    let bare = root_text.trim_start_matches("this.").trim().to_string();
    bare.ends_with("Repo") || bare.ends_with("Repository") || bare == "em" || bare == "entityManager"
}

// ─── JPA-N1-001: findById/findBy* in loop ───────────────────────────────

fn matches_jpa_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_repo(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if last == "findById"
            || last == "getOne"
            || last == "getReferenceById"
            || (last.starts_with("findBy") && last.len() > 6)
        {
            out.push(hit(chain, "JPA-N1-001"));
        }
    }
    out
}

// ─── JPA-QRY-002: @Query with string concat ─────────────────────────────

fn matches_jpa_qry_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for dec in &ctx.decorators {
        let e = &dec.decorator_expr;
        if !e.starts_with("@Query") && !e.contains("@Query(") {
            continue;
        }
        // Heuristic: detect ' + ' (string concat) between strings inside
        // the @Query argument.
        if e.contains("\" + ") || e.contains(" + \"") {
            out.push(MatchHit {
                line: dec.line,
                byte_range: dec.byte_range.clone(),
                extra_evidence: vec![Evidence {
                    call: "JPA-QRY-002".to_string(),
                    line: dec.line,
                    category: None,
                }],
            });
        }
    }
    out
}

// ─── JPA-EAGER-003: @ManyToOne/@OneToOne with FetchType.EAGER ───────────

fn matches_jpa_eager_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for dec in &ctx.decorators {
        let e = &dec.decorator_expr;
        let is_relation = e.contains("@ManyToOne")
            || e.contains("@OneToOne")
            || e.contains("@OneToMany")
            || e.contains("@ManyToMany");
        if !is_relation {
            continue;
        }
        if e.contains("FetchType.EAGER") || e.contains("fetch=FetchType.EAGER") {
            out.push(MatchHit {
                line: dec.line,
                byte_range: dec.byte_range.clone(),
                extra_evidence: vec![Evidence {
                    call: "JPA-EAGER-003".to_string(),
                    line: dec.line,
                    category: None,
                }],
            });
        }
    }
    out
}

// ─── JPA-SAVE-004: repo.save / repo.persist in loop ─────────────────────

fn matches_jpa_save_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_repo(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if matches!(last, "save" | "persist" | "merge") {
            out.push(hit(chain, "JPA-SAVE-004"));
        }
    }
    out
}

pub const JPA_RULES: &[OrmRule] = &[
    OrmRule {
        id: "JPA-N1-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "JPA `repo.findById(...)` / `findBy*` inside a loop or stream — N+1 round-trips.",
        remediation: "Collect ids and call `repo.findAllById(ids)` once.",
        confidence: 0.90,
        matches: matches_jpa_n1_001,
    },
    OrmRule {
        id: "JPA-QRY-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`@Query(\"… \" + var + \"…\")` — string concat inside JPQL/SQL is injection.",
        remediation: "Use named/indexed parameters: `@Query(\"… WHERE name = :name\")` + `@Param(\"name\")`.",
        confidence: 0.95,
        matches: matches_jpa_qry_002,
    },
    OrmRule {
        id: "JPA-EAGER-003",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "JPA relation with `FetchType.EAGER` — every parent load issues a JOIN even when the relation is unused.",
        remediation: "Default to `FetchType.LAZY`; opt into eager loading per query with `@EntityGraph` / `JOIN FETCH`.",
        confidence: 0.85,
        matches: matches_jpa_eager_003,
    },
    OrmRule {
        id: "JPA-SAVE-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`repo.save(entity)` inside a loop — one INSERT/UPDATE per row.",
        remediation: "Collect entities and call `repo.saveAll(list)` once; consider batch size via `hibernate.jdbc.batch_size`.",
        confidence: 0.90,
        matches: matches_jpa_save_004,
    },
];

pub struct JpaDialect;

impl OrmDialect for JpaDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("javax.persistence")
            || ctx.imports.has_any_starting_with("jakarta.persistence")
            || ctx.imports.has_any_starting_with("org.springframework.data")
            || ctx.imports.has_any_starting_with("org.hibernate")
            || ctx.decorators.iter().any(|d| {
                d.decorator_expr.contains("@Entity")
                    || d.decorator_expr.contains("@Repository")
                    || d.decorator_expr.contains("@Query")
            })
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        let mut out = Vec::new();
        for chain in &ctx.chains {
            if !looks_like_repo(chain) {
                continue;
            }
            let last = chain
                .steps
                .last()
                .map(|s| s.method.as_str())
                .unwrap_or("");
            let op = match last {
                m if m == "findById" || m == "findAll" || m.starts_with("findBy") => SqlOp::Select,
                "count" => SqlOp::Select,
                "save" | "persist" => SqlOp::Insert,
                "deleteById" | "delete" => SqlOp::Delete,
                _ => continue,
            };
            let mut stmt = PredictedStatement {
                op,
                tables: vec![TableRef::name(repo_to_table(&chain.root))],
                projection: Projection::Unspecified,
                in_loop: chain.in_loop,
                where_expr: if last == "findById" || last.starts_with("findBy") {
                    Some(WhereExpr::Raw {
                        text: "<where>".into(),
                        has_interpolation: false,
                    })
                } else {
                    None
                },
                ..Default::default()
            };
            let _ = &mut stmt;
            let line = chain.steps.last().map(|s| s.line).unwrap_or(1);
            out.push(PredictedSql {
                orm: OrmKind::Generic,
                dialect: SqlDialect::Postgres,
                statements: vec![stmt],
                fidelity: vec![SqlFidelity::Skeletal],
                source_range: chain.byte_range.clone(),
                line,
            });
        }
        out
    }
}

fn repo_to_table(root: &ChainRoot) -> String {
    let t = match root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => return String::from("?"),
    };
    t.trim_start_matches("this.")
        .trim_end_matches("Repository")
        .trim_end_matches("Repo")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::jvm::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::java::language()).unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = JPA_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn jpa_n1_001_fires_on_findbyid_in_loop() {
        let src = "class X { void f(List<Long> ids) { for (Long id : ids) { userRepo.findById(id); } } }\n";
        let hits = run_rule("JPA-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn jpa_n1_001_clean_with_findallbyid() {
        let src = "class X { void f(List<Long> ids) { userRepo.findAllById(ids); } }\n";
        let hits = run_rule("JPA-N1-001", src);
        assert!(hits.is_empty());
    }

    #[test]
    fn jpa_qry_002_fires_on_string_concat() {
        let src = "interface R { @Query(\"SELECT u FROM User u WHERE u.name = '\" + name + \"'\") List<User> bad(String name); }\n";
        let hits = run_rule("JPA-QRY-002", src);
        assert!(!hits.is_empty(), "JPA-QRY-002 must fire; got 0 hits");
    }


    #[test]
    fn jpa_eager_003_fires_on_explicit_eager() {
        let src = "class User { @ManyToOne(fetch=FetchType.EAGER) Org org; }\n";
        let hits = run_rule("JPA-EAGER-003", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn jpa_save_004_fires_on_save_in_loop() {
        let src = "class X { void f(List<User> us) { for (User u : us) { userRepo.save(u); } } }\n";
        let hits = run_rule("JPA-SAVE-004", src);
        assert!(!hits.is_empty());
    }
}
