//! Slick — rules + dialect detection.
//!
//! Slick is a functional-relational mapper; it doesn't hide N+1
//! behind lazy-loading (queries are explicit `Action`s). The
//! antipatterns we catch are user-introduced:
//!
//! - `SLI-INJ-001` — `sql"… #$x …"` literal interpolation in a Plain
//!   SQL interpolator. The `#$` form interpolates verbatim into the
//!   query string and is documented as injection-prone by Slick itself.
//! - `SLI-N1-002` — `db.run(action)` inside a loop / `.foreach` —
//!   round-trip per row.
//! - `SLI-COMP-003` — ≥2 `db.run(...)` calls in the same function body
//!   without DBIO composition — lost atomicity + extra round-trips.
//! - `SLI-BLK-004` — `Await.result(db.run(...))` inside a loop —
//!   blocks the EC thread per iteration, defeats async.
//! - `SLI-TXN-005` — `db.run(DBIO.seq(...))` /
//!   `db.run(DBIO.sequence(...))` / `db.run(for-comp)` containing a
//!   write op (`+=`, `.update`, `.delete`, `sqlu"…"`) without
//!   `.transactionally` — multi-step composition isn't atomic.
//!
//! KEY DISAMBIGUATION (from the Slick research):
//! - `for { c <- coffees; s <- suppliers if c.supID === s.id } yield ...`
//!   is QUERY composition, NOT iteration — uses Slick's lifted `===`.
//!   Our `db.run` rule is anchored on the chain root being a
//!   database handle, not on for-comprehensions per se, so query
//!   composition without a `db.run` call inside never fires.
//! - `db.run(for { ... } yield ...)` is also fine — the for-comp is
//!   over DBIOs, runs as one round-trip. Same reason.

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

fn looks_like_slick_runner(chain: &CallChain) -> bool {
    let root_text = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => return false,
    };
    let bare = root_text.trim_start_matches("this.").trim().to_string();
    // Common Slick database handle names.
    matches!(bare.as_str(), "db" | "database") || bare.ends_with("Db") || bare.ends_with("DB")
}

// ─── SLI-INJ-001: `sql"… #$x …"` literal interpolation ──────────────────

fn matches_sli_inj_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for dec in &ctx.decorators {
        // Stored as `interp:<interpolator>:<full-text>` in build_context.
        let e = &dec.decorator_expr;
        // Only Slick Plain SQL interpolators are vulnerable to `#$`.
        let is_slick = e.starts_with("interp:sql:")
            || e.starts_with("interp:sqlu:")
            || e.starts_with("interp:tsql:");
        if !is_slick {
            continue;
        }
        if e.contains("#$") {
            out.push(MatchHit {
                line: dec.line,
                byte_range: dec.byte_range.clone(),
                extra_evidence: vec![Evidence {
                    call: "SLI-INJ-001".to_string(),
                    line: dec.line,
                    category: None,
                }],
            });
        }
    }
    out
}

// ─── SLI-N1-002: `db.run(...)` inside a loop ────────────────────────────

fn matches_sli_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_slick_runner(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if matches!(last, "run" | "runAsync") {
            out.push(hit(chain, "SLI-N1-002"));
        }
    }
    out
}

// ─── SLI-COMP-003: ≥2 `db.run(...)` calls in the same function ──────────

fn matches_sli_comp_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    // Find every `db.run` chain (last step == "run", root looks like a db).
    let runs: Vec<&CallChain> = ctx
        .chains
        .iter()
        .filter(|c| {
            looks_like_slick_runner(c)
                && c.steps.last().map(|s| s.method.as_str()) == Some("run")
        })
        .collect();
    if runs.len() < 2 {
        return out;
    }
    // Group runs by which function they live in. If any function
    // contains ≥2, fire once on the second-and-later in that function.
    for func in &ctx.functions {
        let in_func: Vec<&&CallChain> = runs
            .iter()
            .filter(|c| func.byte_range.contains(&c.byte_range.start))
            .collect();
        if in_func.len() < 2 {
            continue;
        }
        // Fire on each but the first to make the multi-hit visible.
        for chain in in_func.iter().skip(1) {
            out.push(hit(chain, "SLI-COMP-003"));
        }
    }
    out
}

// ─── SLI-BLK-004: `Await.result(db.run(...))` inside a loop ─────────────

fn matches_sli_blk_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        // Last step is `result`; somewhere in the chain (typically as a
        // step or in args) we see `Await` and `db.run`.
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last != "result" {
            continue;
        }
        let root_is_await = matches!(
            &chain.root,
            ChainRoot::Identifier(t) if t == "Await",
        );
        // Either: `Await.result(db.run(...), ...)` chain root is Await
        // (then we already pass), or the args include `db.run(`.
        let mentions_db_run = chain
            .steps
            .iter()
            .any(|s| s.args_text.iter().any(|a| a.contains("db.run(") || a.contains(".run(")));
        if root_is_await && mentions_db_run {
            out.push(hit(chain, "SLI-BLK-004"));
        }
    }
    out
}

// ─── SLI-TXN-005: db.run on multi-write composition without `.transactionally`

fn matches_sli_txn_005(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !looks_like_slick_runner(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if !matches!(last, "run" | "runAsync") {
            continue;
        }
        // Last step's args text is the DBIO expression.
        let arg = chain
            .steps
            .last()
            .and_then(|s| s.args_text.first())
            .cloned()
            .unwrap_or_default();
        // Composition markers — these wrap multiple actions.
        let is_composed = arg.contains("DBIO.seq")
            || arg.contains("DBIO.sequence")
            || arg.contains("DBIO.fold")
            // for-comprehension over DBIOs is also composition.
            || (arg.contains("for ") && arg.contains("yield"));
        if !is_composed {
            continue;
        }
        // Write detection: `+=`, `++=`, `.update`, `.delete`, `sqlu"`.
        let has_write = arg.contains(" += ")
            || arg.contains(" ++= ")
            || arg.contains(".update")
            || arg.contains(".delete")
            || arg.contains("sqlu\"");
        if !has_write {
            continue;
        }
        // Already transactional?
        if arg.contains("transactionally") {
            continue;
        }
        out.push(hit(chain, "SLI-TXN-005"));
    }
    out
}

pub const SLICK_RULES: &[OrmRule] = &[
    OrmRule {
        id: "SLI-INJ-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Slick `sql\"… #$x …\"` literal interpolation — bypasses bind variables and is vulnerable to SQL injection.",
        remediation: "Use `$x` (without `#`) so Slick binds the value as a parameter; `#$` is documented as injection-prone.",
        confidence: 0.95,
        matches: matches_sli_inj_001,
    },
    OrmRule {
        id: "SLI-N1-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Slick `db.run(...)` inside a loop / `.foreach` — one round-trip per row.",
        remediation: "Compose actions with `DBIO.sequence` / `DBIO.fold` and run them in a single `db.run`; use `.in` filters for batch reads.",
        confidence: 0.85,
        matches: matches_sli_n1_002,
    },
    OrmRule {
        id: "SLI-COMP-003",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "Multiple sequential `db.run(...)` calls in one function — lost atomicity and extra round-trips.",
        remediation: "Compose with `DBIO.seq` / `DBIO.sequence` / for-comprehension over DBIOs and run once: `db.run(combined.transactionally)`.",
        confidence: 0.75,
        matches: matches_sli_comp_003,
    },
    OrmRule {
        id: "SLI-BLK-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`Await.result(db.run(...))` inside a loop — blocks the EC thread per iteration, defeats async.",
        remediation: "Move blocking out of the loop; compose DBIOs and `Await` once, or keep the `Future` and let the caller await.",
        confidence: 0.85,
        matches: matches_sli_blk_004,
    },
    OrmRule {
        id: "SLI-TXN-005",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Trivial,
        message: "`db.run(DBIO.seq(...write...))` without `.transactionally` — partial failure leaves inconsistent state.",
        remediation: "Add `.transactionally` to the composed action: `db.run(combined.transactionally)`.",
        confidence: 0.80,
        matches: matches_sli_txn_005,
    },
];

pub struct SlickDialect;

impl OrmDialect for SlickDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("slick")
            || ctx.decorators.iter().any(|d| {
                d.decorator_expr.starts_with("interp:sql:")
                    || d.decorator_expr.starts_with("interp:sqlu:")
                    || d.decorator_expr.starts_with("interp:tsql:")
            })
    }

    fn predict_all(&self, _ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        // Slick Plain SQL is already-string and read directly; the
        // SQL-IR rules fire on inline SQL via the separate sql_lint
        // pass. No predicted SQL emitted from this dialect.
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
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = SLICK_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn sli_inj_001_fires_on_hash_dollar_interpolation() {
        let src = r#"object F { val q = sql"SELECT * FROM u WHERE x = #${id}" }"#;
        let hits = run_rule("SLI-INJ-001", src);
        assert!(!hits.is_empty(), "SLI-INJ-001 must fire on `sql\"... #${{id}} ...\"`");
    }

    #[test]
    fn sli_inj_001_clean_on_dollar_interpolation() {
        let src = r#"object F { val q = sql"SELECT * FROM u WHERE x = ${id}" }"#;
        let hits = run_rule("SLI-INJ-001", src);
        assert!(hits.is_empty(), "SLI-INJ-001 must not fire on safe `$id` interp");
    }

    #[test]
    fn sli_n1_002_fires_on_db_run_in_for() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def bad(ids: Seq[Long]) = {
    for (id <- ids) { db.run(query) }
  }
}
"#;
        let hits = run_rule("SLI-N1-002", src);
        assert!(!hits.is_empty(), "SLI-N1-002 must fire on db.run inside `for`");
    }

    #[test]
    fn sli_n1_002_fires_on_db_run_in_foreach() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F { def bad(ids: Seq[Long]) = ids.foreach { id => db.run(query) } }
"#;
        let hits = run_rule("SLI-N1-002", src);
        assert!(!hits.is_empty(), "SLI-N1-002 must fire on db.run inside `.foreach`");
    }

    #[test]
    fn sli_n1_002_clean_when_run_outside_loop() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F { def good() = db.run(query) }
"#;
        let hits = run_rule("SLI-N1-002", src);
        assert!(hits.is_empty(), "SLI-N1-002 must not fire on single db.run");
    }

    #[test]
    fn dialect_matches_with_slick_import() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {}
"#;
        let (c, _t) = ctx(src);
        assert!(SlickDialect.matches(&c));
    }

    // ─── New rules: SLI-COMP-003, SLI-BLK-004 ──────────────────────────

    #[test]
    fn sli_comp_003_fires_on_two_db_run_in_same_function() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def transfer(from: Int, to: Int) = {
    val a = db.run(accounts.filter(_.id === from).map(_.balance).update(0))
    val b = db.run(accounts.filter(_.id === to).map(_.balance).update(100))
  }
}
"#;
        let hits = run_rule("SLI-COMP-003", src);
        assert!(
            !hits.is_empty(),
            "SLI-COMP-003 must fire on 2 db.run in one function, got 0"
        );
    }

    #[test]
    fn sli_comp_003_clean_on_single_db_run() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def get(id: Int) = db.run(users.filter(_.id === id).result)
}
"#;
        let hits = run_rule("SLI-COMP-003", src);
        assert!(hits.is_empty(), "SLI-COMP-003 must not fire on single db.run");
    }

    #[test]
    fn sli_comp_003_clean_across_separate_functions() {
        // Two db.run, but in DIFFERENT functions — fine.
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def a(id: Int) = db.run(users.filter(_.id === id).result)
  def b(id: Int) = db.run(orders.filter(_.userId === id).result)
}
"#;
        let hits = run_rule("SLI-COMP-003", src);
        assert!(hits.is_empty(), "SLI-COMP-003 must not fire across separate functions");
    }

    #[test]
    fn sli_blk_004_fires_on_await_db_run_in_loop() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
import scala.concurrent.Await
import scala.concurrent.duration.Duration
object F {
  def bad(ids: Seq[Int]) = ids.map { id =>
    Await.result(db.run(coffees.filter(_.supID === id).result), Duration.Inf)
  }
}
"#;
        let hits = run_rule("SLI-BLK-004", src);
        assert!(!hits.is_empty(), "SLI-BLK-004 must fire on Await.result(db.run) in loop");
    }

    #[test]
    fn sli_blk_004_clean_outside_loop() {
        let src = r#"
import scala.concurrent.Await
import scala.concurrent.duration.Duration
object F {
  def good() = Await.result(db.run(q), Duration.Inf)
}
"#;
        let hits = run_rule("SLI-BLK-004", src);
        assert!(hits.is_empty(), "SLI-BLK-004 must not fire on Await outside loop");
    }

    // ─── False-positive guards (legitimate Slick patterns) ─────────────

    #[test]
    fn sli_n1_002_clean_on_monadic_for_over_table_query() {
        // Slick monadic JOIN: `for { c <- coffees; s <- suppliers if c.supID === s.id }`
        // is QUERY composition, NOT iteration. There's no db.run inside it.
        // Even with our generic loop-marking of for_expression, this is
        // safe because the body doesn't contain db.run.
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  val joined = for {
    c <- coffees
    s <- suppliers if c.supID === s.id
  } yield (c.name, s.name)
}
"#;
        let hits = run_rule("SLI-N1-002", src);
        assert!(hits.is_empty(), "SLI-N1-002 must not fire on Slick monadic query for-comprehension");
    }

    #[test]
    fn sli_n1_002_clean_on_db_run_with_inner_for_comprehension() {
        // `db.run(for { x <- ...; y <- ... } yield ...)` — single trip.
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def good() = db.run(for {
    count <- coffees.length.result
    _ <- coffees.filter(_.price < 5.0).delete
  } yield count)
}
"#;
        let hits = run_rule("SLI-N1-002", src);
        assert!(hits.is_empty(), "SLI-N1-002 must not fire on db.run wrapping a DBIO for-comp");
    }

    #[test]
    fn sli_n1_002_fires_on_future_sequence_xs_map_db_run() {
        // Classic Future.sequence(xs.map(id => db.run(...))) N+1 idiom.
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def bad(ids: Seq[Int]) = Future.sequence(ids.map { id =>
    db.run(coffees.filter(_.supID === id).result)
  })
}
"#;
        let hits = run_rule("SLI-N1-002", src);
        assert!(!hits.is_empty(), "SLI-N1-002 must fire on db.run inside ids.map");
    }

    // ─── SLI-TXN-005 ────────────────────────────────────────────────────

    #[test]
    fn sli_txn_005_fires_on_dbio_seq_writes_without_transactionally() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def transfer() = db.run(DBIO.seq(
    accounts.filter(_.id === 1).map(_.balance).update(0),
    accounts.filter(_.id === 2).map(_.balance).update(100)
  ))
}
"#;
        let hits = run_rule("SLI-TXN-005", src);
        assert!(
            !hits.is_empty(),
            "SLI-TXN-005 must fire on DBIO.seq with writes and no transactionally"
        );
    }

    #[test]
    fn sli_txn_005_clean_with_transactionally() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def transfer() = db.run(DBIO.seq(
    accounts.filter(_.id === 1).map(_.balance).update(0),
    accounts.filter(_.id === 2).map(_.balance).update(100)
  ).transactionally)
}
"#;
        let hits = run_rule("SLI-TXN-005", src);
        assert!(hits.is_empty(), "SLI-TXN-005 must NOT fire when .transactionally is present");
    }

    #[test]
    fn sli_txn_005_clean_on_read_only_composition() {
        // DBIO.seq with only reads is fine without `.transactionally`.
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def readBoth() = db.run(DBIO.seq(users.length.result, orders.length.result))
}
"#;
        let hits = run_rule("SLI-TXN-005", src);
        assert!(
            hits.is_empty(),
            "SLI-TXN-005 must NOT fire on read-only DBIO.seq"
        );
    }

    #[test]
    fn sli_txn_005_clean_on_single_write_run() {
        // Single write `db.run(coffees += ...)` — no composition; transactionally is redundant.
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object F {
  def insertOne() = db.run(coffees += ("Espresso", 9.99))
}
"#;
        let hits = run_rule("SLI-TXN-005", src);
        assert!(hits.is_empty(), "SLI-TXN-005 must NOT fire on single-statement db.run");
    }

    #[test]
    fn sli_inj_001_clean_on_compile_time_table_name() {
        // `#$table` where table is a `val` bound to a literal — flagged
        // anyway by our conservative rule. The user is expected to
        // either inline or accept the finding as informational.
        let src = r#"object F { val table = "coffees"; val q = sql"select * from #$table".as[Coffee] }"#;
        let hits = run_rule("SLI-INJ-001", src);
        assert!(!hits.is_empty(), "SLI-INJ-001 is conservative: any #$ fires (informational)");
    }
}
