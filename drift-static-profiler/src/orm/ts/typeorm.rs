//! TypeORM — decorator-driven schema + opaque builder client API
//! (F3 + decorator-hybrid family per master plan §CCC.5).
//!
//! Phase 2 v1 rules:
//! - `TO-N1-001` — `repo.findOne(...)` inside a loop
//! - `TO-EAGER-002` — `@Entity` field with `{ eager: true }` on a *-to-many relation
//! - `TO-QB-003` — `createQueryBuilder()` with `.where(\`…${var}…\`)` interpolation
//! - `TO-SYNC-004` — `DataSource` config with `synchronize: true` outside test/dev guard

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
    if bare.ends_with("Repo") || bare.ends_with("Repository") || bare == "repo" {
        return true;
    }
    // `this.userRepo.findOne(...)` — root is `this`, first step is
    // the property name. Check that property too.
    if bare == "this" {
        if let Some(first) = chain.steps.first() {
            let m = &first.method;
            if m.ends_with("Repo") || m.ends_with("Repository") || m == "repo" {
                return true;
            }
        }
    }
    false
}

// ─── TO-N1-001: repo.findOne / findOneBy in loop ────────────────────────

fn matches_to_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
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
        if matches!(last, "findOne" | "findOneBy" | "findOneByOrFail") {
            out.push(hit(chain, "TO-N1-001"));
        }
    }
    out
}

// ─── TO-EAGER-002: @Entity field with eager:true on a *-to-many ─────────

fn matches_to_eager_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for dec in &ctx.decorators {
        let e = &dec.decorator_expr;
        let is_collection = e.contains("@OneToMany") || e.contains("@ManyToMany");
        if !is_collection {
            continue;
        }
        if e.contains("eager:") && e.contains("true") {
            out.push(MatchHit {
                line: dec.line,
                byte_range: dec.byte_range.clone(),
                extra_evidence: vec![Evidence {
                    call: "TO-EAGER-002".to_string(),
                    line: dec.line,
                    category: None,
                }],
            });
        }
    }
    out
}

// ─── TO-QB-003: createQueryBuilder().where(`…${x}…`) ────────────────────

fn matches_to_qb_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if !methods.contains(&"createQueryBuilder") {
            continue;
        }
        for step in &chain.steps {
            if matches!(step.method.as_str(), "where" | "andWhere" | "orWhere") {
                for arg in &step.args_text {
                    if arg.starts_with('`') && arg.contains("${") {
                        out.push(hit(chain, "TO-QB-003"));
                        break;
                    }
                }
            }
        }
    }
    out
}

// ─── TO-SYNC-004: synchronize: true in DataSource ───────────────────────

fn matches_to_sync_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if !methods.iter().any(|m| *m == "DataSource") {
            continue;
        }
        for step in &chain.steps {
            for arg in &step.args_text {
                if arg.contains("synchronize") && arg.contains("true") {
                    out.push(hit(chain, "TO-SYNC-004"));
                    break;
                }
            }
        }
    }
    out
}

pub const TYPEORM_RULES: &[OrmRule] = &[
    OrmRule {
        id: "TO-N1-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "TypeORM `repo.findOne(...)` / `findOneBy(...)` inside a loop — N+1 round-trips.",
        remediation: "Collect ids and call `repo.findBy({ id: In(ids) })` once.",
        confidence: 0.90,
        matches: matches_to_n1_001,
    },
    OrmRule {
        id: "TO-EAGER-002",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "TypeORM `@OneToMany`/`@ManyToMany` with `eager: true` — every load issues a JOIN on the collection.",
        remediation: "Drop `eager: true`; explicitly request the relation per query with `.find({ relations: ['posts'] })`.",
        confidence: 0.85,
        matches: matches_to_eager_002,
    },
    OrmRule {
        id: "TO-QB-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Template interpolation in TypeORM QueryBuilder `.where(\\`…${x}…\\`)` — SQL injection.",
        remediation: "Use parameters: `.where('col = :v', { v: value })`.",
        confidence: 0.95,
        matches: matches_to_qb_003,
    },
    OrmRule {
        id: "TO-SYNC-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "TypeORM `DataSource` with `synchronize: true` — runs schema migrations on boot, can drop columns.",
        remediation: "Set `synchronize: false` in production. Gate via env: `synchronize: process.env.NODE_ENV !== 'production'`.",
        confidence: 0.95,
        matches: matches_to_sync_004,
    },
];

pub struct TypeormDialect;

impl OrmDialect for TypeormDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("typeorm")
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        // Phase 1 TypeORM: emit a coarse predicted SQL for
        // `repo.find(...)` / `repo.findOne(...)` chains so cross-ORM
        // SQL-IR rules can fire. Refined in Phase 2.1.
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
                "find" | "findBy" | "findOne" | "findOneBy" | "count" => SqlOp::Select,
                "save" | "insert" => SqlOp::Insert,
                "update" => SqlOp::Update,
                "delete" | "remove" => SqlOp::Delete,
                _ => continue,
            };
            let mut stmt = PredictedStatement {
                op,
                tables: vec![TableRef::name(repo_to_table(&chain.root))],
                projection: Projection::Unspecified,
                in_loop: chain.in_loop,
                where_expr: if matches!(last, "findBy" | "findOneBy") {
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
    use crate::orm::ts::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::typescript::language())
            .unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = TYPEORM_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn to_qb_003_fires_on_template_where() {
        let src = "userRepo.createQueryBuilder('u').where(`u.name = '${name}'`).getMany();\n";
        let hits = run_rule("TO-QB-003", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn to_sync_004_fires_on_synchronize_true() {
        let src = "const ds = new DataSource({ type: 'postgres', synchronize: true });\n";
        let hits = run_rule("TO-SYNC-004", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn to_n1_001_fires_on_findone_in_loop() {
        let src = "for (const id of ids) {\n  await userRepo.findOne({ where: { id } });\n}\n";
        let hits = run_rule("TO-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn to_eager_002_fires_on_onetomany_eager() {
        let src = "class User {\n  @OneToMany(() => Post, p => p.user, { eager: true })\n  posts: Post[];\n}\n";
        let hits = run_rule("TO-EAGER-002", src);
        assert!(!hits.is_empty());
    }
}
