//! Sequelize — TypeScript / Node ORM with model classes + find APIs.
//!
//! Phase 2.1 rules:
//! - `SEQ-N1-001` — `Model.findByPk(...)` / `Model.findOne(...)` inside a loop
//! - `SEQ-RAW-002` — `sequelize.query(`…${x}…`)` template interpolation
//! - `SEQ-SAVE-003` — `instance.save()` inside a loop
//! - `SEQ-SYNC-004` — `sequelize.sync({ force: true })` outside test env

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

fn is_model_class_root(chain: &CallChain) -> bool {
    // Heuristic: chain root is a PascalCase identifier (a Sequelize model
    // class) and the first step is a Sequelize static method.
    let r = root_text(chain);
    let first_char_upper = r.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
    if !first_char_upper {
        return false;
    }
    let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
    methods.iter().any(|m| {
        matches!(
            *m,
            "findAll"
                | "findOne"
                | "findByPk"
                | "findOrCreate"
                | "create"
                | "bulkCreate"
                | "update"
                | "destroy"
                | "count"
        )
    })
}

fn matches_seq_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !is_model_class_root(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if matches!(last, "findByPk" | "findOne") {
            out.push(hit(chain, "SEQ-N1-001"));
        }
    }
    out
}

fn matches_seq_raw_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let r = root_text(chain);
        if r != "sequelize" && r != "db" {
            continue;
        }
        for step in &chain.steps {
            if step.method != "query" {
                continue;
            }
            for arg in &step.args_text {
                if arg.starts_with('`') && arg.contains("${") {
                    out.push(hit(chain, "SEQ-RAW-002"));
                    break;
                }
            }
        }
    }
    out
}

fn matches_seq_save_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if matches!(last, "save" | "update" | "destroy") {
            // Need to make sure the chain root is a loop-var instance,
            // not a Sequelize model class.
            if !is_model_class_root(chain) {
                out.push(hit(chain, "SEQ-SAVE-003"));
            }
        }
    }
    out
}

fn matches_seq_sync_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let r = root_text(chain);
        if r != "sequelize" && r != "db" {
            continue;
        }
        for step in &chain.steps {
            if step.method != "sync" {
                continue;
            }
            for arg in &step.args_text {
                if arg.contains("force") && arg.contains("true") {
                    out.push(hit(chain, "SEQ-SYNC-004"));
                    break;
                }
            }
        }
    }
    out
}

pub const SEQUELIZE_RULES: &[OrmRule] = &[
    OrmRule {
        id: "SEQ-N1-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Sequelize `Model.findOne/findByPk(...)` inside a loop — N+1 round-trips.",
        remediation: "Collect ids and call `Model.findAll({ where: { id: ids } })` once.",
        confidence: 0.90,
        matches: matches_seq_n1_001,
    },
    OrmRule {
        id: "SEQ-RAW-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Template interpolation in `sequelize.query(`…${x}…`)` — SQL injection.",
        remediation: "Use replacements/bind: `sequelize.query('… :name', { replacements: { name } })`.",
        confidence: 0.95,
        matches: matches_seq_raw_002,
    },
    OrmRule {
        id: "SEQ-SAVE-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Sequelize `instance.save()` / `.update()` / `.destroy()` inside a loop.",
        remediation: "Build a list and call `Model.bulkCreate(rows)` or `Model.update({...}, { where })`.",
        confidence: 0.85,
        matches: matches_seq_save_003,
    },
    OrmRule {
        id: "SEQ-SYNC-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Trivial,
        message: "`sequelize.sync({ force: true })` — drops and recreates every table on boot.",
        remediation: "Never run `force: true` in production; use migrations (`umzug` / `sequelize-cli`).",
        confidence: 0.95,
        matches: matches_seq_sync_004,
    },
];

pub struct SequelizeDialect;

impl OrmDialect for SequelizeDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports
            .modules
            .keys()
            .any(|m| m == "sequelize" || m.starts_with("sequelize/"))
            || ctx
                .imports
                .modules
                .values()
                .flatten()
                .any(|v| v == "Sequelize" || v == "Model" || v == "DataTypes")
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        let mut out = Vec::new();
        for chain in &ctx.chains {
            if !is_model_class_root(chain) {
                continue;
            }
            let last = chain
                .steps
                .last()
                .map(|s| s.method.as_str())
                .unwrap_or("");
            let op = match last {
                "findAll" | "findOne" | "findByPk" | "count" => SqlOp::Select,
                "create" | "bulkCreate" => SqlOp::Insert,
                "update" => SqlOp::Update,
                "destroy" => SqlOp::Delete,
                _ => continue,
            };
            let stmt = PredictedStatement {
                op,
                tables: vec![TableRef::name(root_text(chain).to_ascii_lowercase())],
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
        let rule = SEQUELIZE_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn seq_n1_001_fires_in_loop() {
        let src = "for (const id of ids) { await User.findByPk(id); }\n";
        let hits = run_rule("SEQ-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn seq_raw_002_fires_on_template_interp() {
        let src = "sequelize.query(`SELECT * FROM users WHERE name = '${name}'`);\n";
        let hits = run_rule("SEQ-RAW-002", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn seq_sync_004_fires_on_force_true() {
        let src = "sequelize.sync({ force: true });\n";
        let hits = run_rule("SEQ-SYNC-004", src);
        assert!(!hits.is_empty());
    }
}
