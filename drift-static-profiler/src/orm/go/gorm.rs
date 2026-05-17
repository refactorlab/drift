//! GORM — Go's most-popular ORM. Phase 4 v1 rules:
//! - `GORM-N1-001` — `db.First(&x, id)` / `db.Find(&x).First()` in loop
//! - `GORM-RAW-002` — `db.Raw(fmt.Sprintf(...))` — `%s` interpolation
//! - `GORM-AUTO-003` — `db.AutoMigrate(...)` at top-level / in `main`
//! - `GORM-SAVE-004` — `db.Create(&x)` / `db.Save(&x)` in loop

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::dialect::OrmDialect;
use crate::orm::sql_ir::{
    OrmKind, PredictedSql, PredictedStatement, Projection, SqlDialect, SqlFidelity, SqlOp,
    TableRef,
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

fn root_text(chain: &CallChain) -> String {
    match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => String::new(),
    }
}

fn is_db_chain(chain: &CallChain) -> bool {
    let r = root_text(chain);
    let bare = r.trim_start_matches("h.").trim_start_matches("s.");
    bare == "db" || bare == "DB" || bare == "tx" || bare.ends_with("DB")
}

fn matches_gorm_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !is_db_chain(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if matches!(last, "First" | "Take" | "Last" | "FirstOrInit" | "FirstOrCreate") {
            out.push(hit(chain, "GORM-N1-001"));
        }
    }
    out
}


fn matches_gorm_raw_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if !matches!(step.method.as_str(), "Raw" | "Exec") {
                continue;
            }
            for arg in &step.args_text {
                // Detect fmt.Sprintf inside arg, OR `+` concat with non-literal.
                if arg.contains("fmt.Sprintf")
                    || arg.contains("fmt.Sprint")
                    || arg.contains("\" + ")
                    || arg.contains(" + \"")
                {
                    out.push(hit(chain, "GORM-RAW-002"));
                    break;
                }
            }
        }
    }
    out
}

fn matches_gorm_auto_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !is_db_chain(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if last == "AutoMigrate" {
            out.push(hit(chain, "GORM-AUTO-003"));
        }
    }
    out
}

fn matches_gorm_save_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !is_db_chain(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if matches!(last, "Create" | "Save" | "Update" | "Updates") {
            out.push(hit(chain, "GORM-SAVE-004"));
        }
    }
    out
}

pub const GORM_RULES: &[OrmRule] = &[
    OrmRule {
        id: "GORM-N1-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "GORM `db.First/Take/Last(...)` inside a loop — N+1 queries.",
        remediation: "Collect ids and use `db.Where(\"id IN ?\", ids).Find(&users)` once.",
        confidence: 0.90,
        matches: matches_gorm_n1_001,
    },
    OrmRule {
        id: "GORM-RAW-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "GORM `db.Raw(fmt.Sprintf(...))` — formatted SQL is injection.",
        remediation: "Use parameter placeholders: `db.Raw(\"SELECT * FROM u WHERE name = ?\", name)`.",
        confidence: 0.95,
        matches: matches_gorm_raw_002,
    },
    OrmRule {
        id: "GORM-AUTO-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Medium,
        message: "GORM `db.AutoMigrate(...)` runs at boot — can drop columns and lock tables in prod.",
        remediation: "Run migrations as a separate offline step (golang-migrate, atlas) gated by deploy.",
        confidence: 0.95,
        matches: matches_gorm_auto_003,
    },
    OrmRule {
        id: "GORM-SAVE-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "GORM `db.Create(&x)` / `Save(&x)` inside a loop — one INSERT per row.",
        remediation: "Build a slice and call `db.Create(&users)` (GORM batches automatically).",
        confidence: 0.90,
        matches: matches_gorm_save_004,
    },
];

pub struct GormDialect;

impl OrmDialect for GormDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports
            .modules
            .keys()
            .any(|m| m.contains("gorm.io") || m.contains("jinzhu/gorm"))
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        let mut out = Vec::new();
        for chain in &ctx.chains {
            if !is_db_chain(chain) {
                continue;
            }
            let last = chain
                .steps
                .last()
                .map(|s| s.method.as_str())
                .unwrap_or("");
            let op = match last {
                "First" | "Take" | "Last" | "Find" | "Scan" | "Pluck" => SqlOp::Select,
                "Update" | "Updates" => SqlOp::Update,
                "Delete" | "Unscoped" => SqlOp::Delete,
                // For Create/Save we'd want a column-list aware emitter
                // before triggering SQLIR-003. Phase 1: don't predict
                // for these — the GORM-SAVE-004 rule covers them.
                _ => continue,
            };
            let stmt = PredictedStatement {
                op,
                tables: vec![TableRef::name("<gorm>".to_string())],
                projection: Projection::Unspecified,
                in_loop: chain.in_loop,
                ..Default::default()
            };
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::go::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::go::language()).unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = GORM_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn gorm_n1_001_fires_in_for_range() {
        let src = "package main\nfunc f(db *Gorm, ids []int64) {\nfor _, id := range ids {\n  var u User\n  db.First(&u, id)\n}\n}\n";
        let hits = run_rule("GORM-N1-001", src);
        assert!(!hits.is_empty(), "GORM First in range loop must fire");
    }

    #[test]
    fn gorm_raw_002_fires_on_sprintf() {
        let src = "package main\nfunc f(db *Gorm, name string) {\ndb.Raw(fmt.Sprintf(\"SELECT * FROM u WHERE name='%s'\", name))\n}\n";
        let hits = run_rule("GORM-RAW-002", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn gorm_auto_003_fires_on_automigrate() {
        let src = "package main\nfunc main() { db.AutoMigrate(&User{}) }\n";
        let hits = run_rule("GORM-AUTO-003", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn gorm_save_004_fires_in_loop() {
        let src = "package main\nfunc f(db *Gorm, us []User) {\nfor _, u := range us {\n  db.Create(&u)\n}\n}\n";
        let hits = run_rule("GORM-SAVE-004", src);
        assert!(!hits.is_empty());
    }
}
