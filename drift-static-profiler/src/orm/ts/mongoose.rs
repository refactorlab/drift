//! Mongoose — MongoDB document ORM. No SQL-IR (this is NoSQL).
//!
//! Phase 2.1 rules:
//! - `MNG-POP-001` — chained `.populate('rel').populate('rel2').populate('rel3')`
//!   (>=3 populates → unbounded join graph)
//! - `MNG-N1-002` — `Model.findById(...)` inside a loop
//! - `MNG-LEAN-003` — `.find(...)` then `.toObject()` per row in loop
//!   (use `.lean()` for read-only queries)
//! - `MNG-RAW-004` — `db.collection(...).find({ $where: \`…${x}…\` })`
//!   — JavaScript-injection-shaped `$where` predicate.

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::shape::{matches_by_shape, ComboRule, RootPredicate, ShapeSpec};
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

fn is_pascal_root(chain: &CallChain) -> bool {
    match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => {
            t.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
        }
        _ => false,
    }
}

fn matches_mng_pop_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let populate_count = chain
            .steps
            .iter()
            .filter(|s| s.method == "populate")
            .count();
        if populate_count >= 3 {
            out.push(hit(chain, "MNG-POP-001"));
        }
    }
    out
}

fn matches_mng_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !is_pascal_root(chain) {
            continue;
        }
        let last = chain
            .steps
            .last()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if matches!(last, "findById" | "findOne") {
            out.push(hit(chain, "MNG-N1-002"));
        }
    }
    out
}

fn matches_mng_lean_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        // Iterating findAll results without .lean() — flag if any
        // `.toObject()` / `.toJSON()` call in loop body that's NOT
        // already on a .lean() chain.
        if methods.iter().any(|m| matches!(*m, "toObject" | "toJSON"))
            && !methods.iter().any(|m| *m == "lean")
        {
            out.push(hit(chain, "MNG-LEAN-003"));
        }
    }
    out
}

fn matches_mng_raw_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if step.method != "find" && step.method != "findOne" {
                continue;
            }
            for arg in &step.args_text {
                // `$where: \`…${x}…\`` — interpolation inside a $where
                // predicate becomes JS injection.
                if arg.contains("$where") && arg.contains("${") {
                    out.push(hit(chain, "MNG-RAW-004"));
                    break;
                }
            }
        }
    }
    out
}

/// Shape-based fallback for Mongoose. Distinctive method spellings
/// (`findByIdAndUpdate`, `findOneAndReplace`) and the `Schema` factory
/// are unique to Mongoose. The combo `<Model>.findById(...)` /
/// `<Model>.find(...).populate(...)` is the canonical Mongoose pattern.
/// We require `.populate(...)` in the continuation because plain
/// `Model.find(...)` overlaps with Sequelize.
pub const MONGOOSE_SHAPE: ShapeSpec = ShapeSpec {
    anchors: &[
        "findByIdAndUpdate",
        "findByIdAndRemove",
        "findByIdAndDelete",
        "findOneAndUpdate",
        "findOneAndReplace",
        "findOneAndDelete",
        "markModified",
    ],
    combos: &[ComboRule {
        first_method: "find",
        root: RootPredicate::FirstCharUppercase,
        continuation_any: &["populate", "lean", "select", "exec"],
    }],
};

/// Public detection helper used by `orm::mod`'s TS dispatcher. Matches
/// when an explicit `mongoose` import is present OR when the file's
/// chains exhibit a Mongoose shape (factory-wrapped client).
pub fn matches_mongoose(ctx: &PyOrmContext<'_>) -> bool {
    let imported = ctx
        .imports
        .modules
        .keys()
        .any(|m| m == "mongoose" || m.starts_with("mongoose/"));
    imported || matches_by_shape(&ctx.chains, &MONGOOSE_SHAPE)
}

pub const MONGOOSE_RULES: &[OrmRule] = &[
    OrmRule {
        id: "MNG-POP-001",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "Three or more `.populate(...)` calls on one Mongoose query — multiplies result size.",
        remediation: "Flatten to per-relation `.populate(...)` only when needed, or aggregate via `$lookup` pipelines.",
        confidence: 0.80,
        matches: matches_mng_pop_001,
    },
    OrmRule {
        id: "MNG-N1-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`Model.findById(...)` / `findOne(...)` inside a loop — N+1 round-trips.",
        remediation: "Use `Model.find({ _id: { $in: ids } })` once.",
        confidence: 0.90,
        matches: matches_mng_n1_002,
    },
    OrmRule {
        id: "MNG-LEAN-003",
        framework: Framework::Generic,
        severity: Severity::Low,
        effort: Effort::Trivial,
        message: "Iterating Mongoose documents + calling `.toObject()`/`.toJSON()` — Hydrator allocates per row.",
        remediation: "Use `.lean()` to skip Mongoose document hydration for read-only paths.",
        confidence: 0.70,
        matches: matches_mng_lean_003,
    },
    OrmRule {
        id: "MNG-RAW-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`$where` predicate with template-literal interpolation — JS injection (server-side eval).",
        remediation: "Replace `$where` with structured query operators (`$eq`, `$expr`, etc.).",
        confidence: 0.95,
        matches: matches_mng_raw_004,
    },
];

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
        let rule = MONGOOSE_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn mng_pop_001_fires_on_triple_populate() {
        let src = "User.find().populate('a').populate('b').populate('c');\n";
        let hits = run_rule("MNG-POP-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn mng_n1_002_fires_in_loop() {
        let src = "for (const id of ids) { await User.findById(id); }\n";
        let hits = run_rule("MNG-N1-002", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn mng_n1_002_safe_outside_loop() {
        let src = "const u = await User.findById(id);\n";
        let hits = run_rule("MNG-N1-002", src);
        assert!(hits.is_empty(), "MNG-N1-002 must NOT fire outside a loop");
    }

    #[test]
    fn mng_n1_002_safe_with_in_batch() {
        // `find({ _id: { $in: ids } })` is the canonical fix for N+1.
        let src = "const us = await User.find({ _id: { $in: ids } });\n";
        let hits = run_rule("MNG-N1-002", src);
        assert!(hits.is_empty(), "MNG-N1-002 must NOT fire on $in batch query");
    }

    #[test]
    fn mng_raw_004_fires_on_where_interp() {
        let src = "User.find({ $where: `this.name === '${name}'` });\n";
        let hits = run_rule("MNG-RAW-004", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn shape_anchor_find_by_id_and_update_fires_without_import() {
        // No `import mongoose` — only the distinctive method name.
        let src = "const u = await User.findByIdAndUpdate(id, { name });\n";
        let (c, _t) = ctx(src);
        assert!(matches_by_shape(&c.chains, &MONGOOSE_SHAPE));
        assert!(matches_mongoose(&c));
    }

    #[test]
    fn shape_combo_model_find_populate_fires() {
        let src = "const u = await User.find({ active: true }).populate('posts');\n";
        let (c, _t) = ctx(src);
        assert!(matches_by_shape(&c.chains, &MONGOOSE_SHAPE));
    }

    #[test]
    fn shape_negative_plain_array_find_does_not_fire() {
        // `xs.find(p)` on a lowercase root with no Mongoose-style
        // continuation must not trigger.
        let src = "const x = items.find(i => i.id === 1);\n";
        let (c, _t) = ctx(src);
        assert!(!matches_by_shape(&c.chains, &MONGOOSE_SHAPE));
    }
}
