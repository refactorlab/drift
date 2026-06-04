//! Quill / ProtoQuill — rules + dialect detection.
//!
//! Quill (and Scala-3 ProtoQuill) generate SQL at compile time, so the
//! "where did this query come from" angle is moot. The failure modes
//! worth flagging are:
//!
//! - `QUI-INJ-001` — `infix"… $x …"` / `sql"… $x …"` (ProtoQuill)
//!   with `#$` raw splice OR with any `$x` not wrapped in `lift(...)`.
//!   In ProtoQuill `infix` was renamed to `sql"…"` because `infix` is
//!   a Scala 3 keyword.
//! - `QUI-N1-002` — `ctx.run(...)` inside a loop / `.foreach` — one
//!   round-trip per row. Use `liftQuery(xs).foreach(v => ...)` INSIDE
//!   `quote { }` so Quill emits a batch INSERT/UPDATE instead.
//! - `QUI-DYN-003` — `set(non-literal, ...)` /
//!   `dynamicQuerySchema(non-literal, ...)` — runtime column/table name
//!   from a String var becomes literal SQL and is injection-prone if
//!   user-controlled.
//!
//! KEY DISAMBIGUATION:
//! - `liftQuery(xs).foreach(p => query[T].insertValue(p))` INSIDE
//!   `quote { ... }` is the CANONICAL batch — must NOT fire QUI-N1-002.
//!   Our rule anchors on `ctx.run(...)` being inside a Scala loop,
//!   never on a `.foreach` inside a quote.

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::dialect::OrmDialect;
use crate::orm::sql_ir::{OrmKind, PredictedSql};
use crate::orm::{Framework, MatchHit, OrmRule};

fn hit(chain: &CallChain, note: &str) -> MatchHit {
    let line = chain.steps.last().map(|s| s.line).unwrap_or(1);
    MatchHit {
        line,
        byte_range: chain.byte_range.clone(),
        extra_evidence: vec![Evidence {
            call: note.to_string(),
            line,
            category: None,
        }],
    }
}

fn looks_like_quill_context(chain: &CallChain) -> bool {
    let root_text = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => return false,
    };
    let bare = root_text.trim_start_matches("this.").trim().to_string();
    // Quill database contexts are conventionally named `ctx` or end
    // in `Ctx` / `Context`. We can't anchor on the type name reliably
    // (Scala 3 unions), so name-based heuristic.
    bare == "ctx"
        || bare == "context"
        || bare.ends_with("Ctx")
        || bare.ends_with("Context")
        || bare.ends_with("ctx")
        || bare.ends_with("context")
}

// ─── QUI-INJ-001: `infix"… $x …"` — raw SQL splice ──────────────────────

fn matches_qui_inj_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for dec in &ctx.decorators {
        // Stored as `interp:<interpolator>:<full-text>` in build_context.
        let e = &dec.decorator_expr;
        if !e.starts_with("interp:infix:") {
            continue;
        }
        // `infix` with any interpolation is a literal splice — Quill
        // does not parameterize it. If it contains a `$` (interpolation
        // marker), flag.
        if e.contains("${") || e.contains("$") {
            // false-positive guard: skip pure-literal `infix"..."` with
            // no interpolation slot. We look beyond the `interp:infix:`
            // prefix at the actual interpolated_string text.
            let payload = &e["interp:infix:".len()..];
            // Skip the leading `infix"` and trailing `"` to inspect content.
            let trimmed = payload
                .trim_start_matches("infix")
                .trim_start_matches('"')
                .trim_end_matches('"');
            if trimmed.contains('$') {
                out.push(MatchHit {
                    line: dec.line,
                    byte_range: dec.byte_range.clone(),
                    extra_evidence: vec![Evidence {
                        call: "QUI-INJ-001".to_string(),
                        line: dec.line,
                        category: None,
                    }],
                });
            }
        }
    }
    out
}

// ─── QUI-N1-002: `ctx.run(...)` inside a loop ───────────────────────────

fn matches_qui_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_quill_context(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last == "run" {
            out.push(hit(chain, "QUI-N1-002"));
        }
    }
    out
}

// ─── QUI-DYN-003: dynamic identifier injection ──────────────────────────

fn looks_like_string_literal(arg: &str) -> bool {
    let t = arg.trim();
    // Plain double-quoted literal.
    t.starts_with('"') && t.ends_with('"')
}

fn matches_qui_dyn_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    // The file is already gated as a Quill file by `QuillDialect::matches`
    // (only then do we run this matcher). Inside a Quill file, any
    // `dynamicQuerySchema(<non-literal>, …)` or `set(<non-literal>, …)`
    // is the dynamic-identifier injection vector.
    //
    // Note: `set` and `dynamicQuerySchema` are typically NOT chained off
    // a receiver; they appear as bare call_expressions inside an
    // `update(…)` arglist or as the source of a chain. We see them as
    // one-step chains with `ChainRoot::Identifier(method)`.
    let file_uses_dynamic = ctx
        .chains
        .iter()
        .any(|c| c.steps.iter().any(|s| s.method.starts_with("dynamicQuery")));
    for chain in &ctx.chains {
        for step in &chain.steps {
            let is_dyn_schema = step.method == "dynamicQuerySchema";
            // `set(...)` is also used in Slick / non-Quill contexts.
            // Anchor on this file containing a `dynamicQuery*` call.
            let is_set = step.method == "set" && file_uses_dynamic;
            if !is_dyn_schema && !is_set {
                continue;
            }
            let Some(first) = step.args_text.first() else {
                continue;
            };
            let first = first.trim();
            // Empty or first char `_` is the safe lambda accessor.
            if first.is_empty() || first.starts_with('_') {
                continue;
            }
            // String literal first arg = safe (compile-time constant).
            if looks_like_string_literal(first) {
                continue;
            }
            out.push(MatchHit {
                line: step.line,
                byte_range: step.byte_range.clone(),
                extra_evidence: vec![Evidence {
                    call: "QUI-DYN-003".to_string(),
                    line: step.line,
                    category: None,
                }],
            });
        }
    }
    out
}

pub const QUILL_RULES: &[OrmRule] = &[
    OrmRule {
        id: "QUI-INJ-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Quill `infix\"… $x …\"` splices the value verbatim into generated SQL — vulnerable to injection.",
        remediation: "Use Quill query DSL (`quote { query[T].filter(...) }`) or restrict `infix` to constant fragments; never include user-controlled `$x` inside `infix`.",
        confidence: 0.90,
        matches: matches_qui_inj_001,
    },
    OrmRule {
        id: "QUI-N1-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Quill `ctx.run(...)` inside a loop / `.foreach` — one round-trip per row.",
        remediation: "Use `liftQuery(xs).foreach(x => query[T].insertValue(...))` (batch) or move `ctx.run` out of the loop with an `in` predicate.",
        confidence: 0.85,
        matches: matches_qui_n1_002,
    },
    OrmRule {
        id: "QUI-DYN-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Quill `dynamicQuerySchema(name, ...)` / `set(name, ...)` with a non-literal — runtime identifier becomes literal SQL, injection-prone.",
        remediation: "Use the lambda form `set(_.colName, value)`; for dynamic table names, validate against an allow-list before passing.",
        confidence: 0.85,
        matches: matches_qui_dyn_003,
    },
];

pub struct QuillDialect;

impl OrmDialect for QuillDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("io.getquill")
            || ctx
                .decorators
                .iter()
                .any(|d| d.decorator_expr.starts_with("interp:infix:"))
            // `ctx.run(quote { ... })` shape on a plausibly-Quill receiver.
            || ctx.chains.iter().any(|c| {
                let last = c.steps.last().map(|s| s.method.as_str()).unwrap_or("");
                last == "run"
                    && looks_like_quill_context(c)
                    && c.steps.iter().any(|s| s.args_text.iter().any(|a| a.contains("quote")))
            })
    }

    fn predict_all(&self, _ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::jvm_scala::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::scala::language()).unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe {
            std::mem::transmute::<&tree_sitter::Tree, &tree_sitter::Tree>(&tree)
        });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = QUILL_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn qui_inj_001_fires_on_infix_with_interpolation() {
        let src = r#"object F { val q = infix"SELECT * FROM u WHERE x = ${id}" }"#;
        let hits = run_rule("QUI-INJ-001", src);
        assert!(!hits.is_empty(), "QUI-INJ-001 must fire on `infix\"... ${{id}} ...\"`");
    }

    #[test]
    fn qui_inj_001_clean_on_constant_infix() {
        // `infix"NOW()"` is fine — no interpolation slot.
        let src = r#"object F { val q = infix"NOW()" }"#;
        let hits = run_rule("QUI-INJ-001", src);
        assert!(hits.is_empty(), "QUI-INJ-001 must not fire on constant infix");
    }

    #[test]
    fn qui_n1_002_fires_on_ctx_run_in_for() {
        let src = r#"
import io.getquill._
object F {
  def bad(ids: Seq[Long]) = {
    for (id <- ids) { ctx.run(quote { query[User].filter(_.id == lift(id)) }) }
  }
}
"#;
        let hits = run_rule("QUI-N1-002", src);
        assert!(!hits.is_empty(), "QUI-N1-002 must fire on ctx.run inside `for`");
    }

    #[test]
    fn qui_n1_002_fires_on_ctx_run_in_foreach() {
        let src = r#"
import io.getquill._
object F {
  def bad(ids: Seq[Long]) = ids.foreach { id =>
    ctx.run(quote { query[User].filter(_.id == lift(id)) })
  }
}
"#;
        let hits = run_rule("QUI-N1-002", src);
        assert!(!hits.is_empty(), "QUI-N1-002 must fire on ctx.run inside foreach");
    }

    #[test]
    fn qui_n1_002_clean_outside_loop() {
        let src = r#"
import io.getquill._
object F { def good() = ctx.run(quote { query[User] }) }
"#;
        let hits = run_rule("QUI-N1-002", src);
        assert!(hits.is_empty(), "QUI-N1-002 must not fire on single ctx.run");
    }

    #[test]
    fn dialect_matches_with_quill_import() {
        let src = r#"
import io.getquill._
object F {}
"#;
        let (c, _t) = ctx(src);
        assert!(QuillDialect.matches(&c));
    }

    // ─── QUI-DYN-003 ────────────────────────────────────────────────────

    #[test]
    fn qui_dyn_003_fires_on_dynamic_table_name_var() {
        let src = r#"
import io.getquill._
object F {
  def bad(tbl: String) = ctx.run(dynamicQuerySchema[Person](tbl, alias(_.name, "pname")))
}
"#;
        let hits = run_rule("QUI-DYN-003", src);
        assert!(!hits.is_empty(), "QUI-DYN-003 must fire on dynamicQuerySchema(non-literal)");
    }

    #[test]
    fn qui_dyn_003_clean_on_dynamic_table_name_literal() {
        let src = r#"
import io.getquill._
object F {
  def good() = ctx.run(dynamicQuerySchema[Person]("people", alias(_.name, "pname")))
}
"#;
        let hits = run_rule("QUI-DYN-003", src);
        assert!(hits.is_empty(), "QUI-DYN-003 must NOT fire on dynamicQuerySchema(string literal)");
    }

    #[test]
    fn qui_dyn_003_fires_on_set_with_variable_column_name() {
        let src = r#"
import io.getquill._
object F {
  def bad(col: String) = dynamicQuery[Person].filter(_.id == 1).update(set(col, quote("John")))
}
"#;
        let hits = run_rule("QUI-DYN-003", src);
        assert!(!hits.is_empty(), "QUI-DYN-003 must fire on set(non-literal) in dynamicQuery");
    }

    #[test]
    fn qui_dyn_003_clean_on_set_lambda_accessor() {
        // `set(_.name, value)` — lambda form is the SAFE accessor.
        let src = r#"
import io.getquill._
object F {
  def good() = dynamicQuery[Person].filter(_.id == 1).update(set(_.name, quote("John")))
}
"#;
        let hits = run_rule("QUI-DYN-003", src);
        assert!(hits.is_empty(), "QUI-DYN-003 must NOT fire on set(_.name, ...) lambda form");
    }

    // ─── False-positive guard: liftQuery.foreach is the canonical batch ─

    #[test]
    fn qui_n1_002_clean_on_liftquery_foreach_inside_quote() {
        // `liftQuery(xs).foreach(p => query[T].insertValue(p))` is the
        // CORRECT batch — the foreach is inside `quote { ... }`, NOT a
        // Scala collection loop. ctx.run is called ONCE.
        let src = r#"
import io.getquill._
object F {
  def good(people: List[Person]) = {
    val a = quote { liftQuery(people).foreach(p => query[Person].insertValue(p)) }
    ctx.run(a)
  }
}
"#;
        let hits = run_rule("QUI-N1-002", src);
        assert!(
            hits.is_empty(),
            "QUI-N1-002 must NOT fire on liftQuery(xs).foreach inside quote (canonical batch)"
        );
    }

    #[test]
    fn qui_n1_002_fires_on_ctx_run_in_xs_map() {
        // `xs.map { p => ctx.run(...) }` — same N+1 idiom, single-arg-list
        // form (not curried like Future.traverse). We exercise the
        // simpler form here; curried `Future.traverse(xs)(f)` is a known
        // limitation of the v1 chain walker.
        let src = r#"
import io.getquill._
object F {
  def bad(people: List[Person]) = people.map { p =>
    ctx.run(quote { query[Person].insertValue(lift(p)) })
  }
}
"#;
        let hits = run_rule("QUI-N1-002", src);
        assert!(!hits.is_empty(), "QUI-N1-002 must fire on ctx.run inside xs.map");
    }

    #[test]
    fn qui_n1_002_clean_on_transaction_wrapping_single_run() {
        // ctx.transaction { ctx.run(...) } — single execution, NOT a loop.
        let src = r#"
import io.getquill._
object F {
  def good() = ctx.transaction { ctx.run(quote { query[Person] }) }
}
"#;
        let hits = run_rule("QUI-N1-002", src);
        assert!(hits.is_empty(), "QUI-N1-002 must NOT fire on transaction wrapping ctx.run");
    }
}
