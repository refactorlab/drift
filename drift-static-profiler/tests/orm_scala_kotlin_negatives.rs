//! Hardened negative tests — enumerate the legitimate Scala/Kotlin
//! ORM idioms from the research agents' findings and verify that our
//! rules DO NOT fire on them. Bulletproofing.
//!
//! Each test exercises a specific idiom the research surfaced as
//! commonly-misclassified, and asserts zero findings of the relevant
//! rule id.

use drift_static_profiler::{
    api::{analyze_roots, AnalyzeOptions},
    roots::DiscoverOpts,
    tree::CallTreeNode,
};
use std::path::PathBuf;

fn run_orm_inline(name: &str, file_name: &str, src: &str) -> Vec<CallTreeNode> {
    // Build a tmp directory + drop the source in it, then run drift over it.
    let mut tmp = std::env::temp_dir();
    tmp.push(format!(
        "drift-orm-neg-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    std::fs::create_dir_all(&tmp).unwrap();
    let path = tmp.join(file_name);
    std::fs::write(&path, src).unwrap();
    struct Cleanup(PathBuf);
    impl Drop for Cleanup {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    let _g = Cleanup(tmp.clone());
    let opts = AnalyzeOptions::default();
    let discover = DiscoverOpts {
        min_reach: 1,
        skip_tests: false,
        ..DiscoverOpts::default()
    };
    let outcome = analyze_roots(&tmp, &discover, &opts).expect("analyze_roots succeeds");
    outcome.report.entries
}

fn count_rule(entries: &[CallTreeNode], rule_id: &str) -> usize {
    fn walk(node: &CallTreeNode, rule_id: &str, count: &mut usize) {
        for f in &node.findings {
            if f.evidence.iter().any(|e| e.call == rule_id) {
                *count += 1;
            }
        }
        for c in &node.children {
            walk(c, rule_id, count);
        }
    }
    let mut n = 0;
    for e in entries {
        walk(e, rule_id, &mut n);
    }
    n
}

// ─── Slick negatives ────────────────────────────────────────────────────

#[test]
fn slick_neg_monadic_join_for_comprehension() {
    // Slick monadic JOIN: a single SQL JOIN expressed as a Scala
    // for-comprehension over TableQuery. Never iteration.
    let src = r#"
package neg
import slick.jdbc.PostgresProfile.api._
class T(tag: Tag) extends Table[(Int, String)](tag, "t") {
  def id = column[Int]("id"); def name = column[String]("name"); def * = (id, name)
}
class Repo(db: Database) {
  val t1 = TableQuery[T]
  val t2 = TableQuery[T]
  val joined = for {
    a <- t1
    b <- t2 if a.id === b.id
  } yield (a.name, b.name)
}
"#;
    let entries = run_orm_inline("slick-monadic", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "SLI-N1-002"),
        0,
        "SLI-N1-002 must NOT fire on monadic for-comp over TableQuery"
    );
}

#[test]
fn slick_neg_db_run_wrapping_dbio_for_comp() {
    // `db.run(for { x <- dbio1; y <- dbio2 } yield ...)` — single round
    // trip, the inner for is over DBIOActions.
    let src = r#"
package neg
import slick.jdbc.PostgresProfile.api._
class Repo(db: Database) {
  val users = TableQuery[Users]
  def countAndDelete() = db.run(for {
    n <- users.length.result
    _ <- users.filter(_.id === 1).delete
  } yield n)
}
class Users(tag: Tag) extends Table[(Int, String)](tag, "u") {
  def id = column[Int]("id"); def name = column[String]("name"); def * = (id, name)
}
"#;
    let entries = run_orm_inline("slick-dbio-for", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "SLI-N1-002"),
        0,
        "SLI-N1-002 must NOT fire on db.run wrapping a DBIO for-comp"
    );
}

#[test]
fn slick_neg_compiled_query_in_module_scope() {
    // `Compiled(...)` at module scope — performance optimization, not an
    // antipattern. Must not trigger.
    let src = r#"
package neg
import slick.jdbc.PostgresProfile.api._
class Repo(db: Database) {
  val users = TableQuery[Users]
  val byIdRange = Compiled(
    (min: Rep[Int], max: Rep[Int]) =>
      for { u <- users if u.id >= min && u.id < max } yield u
  )
}
class Users(tag: Tag) extends Table[(Int, String)](tag, "u") {
  def id = column[Int]("id"); def name = column[String]("name"); def * = (id, name)
}
"#;
    let entries = run_orm_inline("slick-compiled", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "SLI-N1-002"),
        0,
        "SLI-N1-002 must NOT fire on module-scope Compiled query"
    );
}

#[test]
fn slick_neg_safe_sql_interpolation() {
    // `$param` bind variables — safe. Only `#$` is unsafe.
    let src = r#"
package neg
import slick.jdbc.PostgresProfile.api._
class Repo(db: Database) {
  def get(id: Int, name: String) =
    db.run(sql"SELECT * FROM users WHERE id = $id AND name = $name".as[(Int, String)])
}
"#;
    let entries = run_orm_inline("slick-safe-sql", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "SLI-INJ-001"),
        0,
        "SLI-INJ-001 must NOT fire on safe `$` interpolation"
    );
}

// ─── Quill negatives ────────────────────────────────────────────────────

#[test]
fn quill_neg_liftquery_foreach_inside_quote() {
    // Canonical batch — must NOT fire QUI-N1-002.
    let src = r#"
package neg
import io.getquill._
class Repo(ctx: PostgresJdbcContext[SnakeCase]) {
  import ctx._
  case class P(id: Int, name: String)
  def batch(people: List[P]) = ctx.run(quote {
    liftQuery(people).foreach(p => query[P].insertValue(p))
  })
}
"#;
    let entries = run_orm_inline("quill-liftquery", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "QUI-N1-002"),
        0,
        "QUI-N1-002 must NOT fire on liftQuery(xs).foreach inside quote"
    );
}

#[test]
fn quill_neg_constant_infix() {
    // `infix"NOW()"` — no interpolation slot. Safe.
    let src = r#"
package neg
import io.getquill._
class Repo(ctx: PostgresJdbcContext[SnakeCase]) {
  import ctx._
  case class P(id: Int)
  def now() = ctx.run(quote {
    query[P].map(_ => infix"NOW()".as[java.time.Instant])
  })
}
"#;
    let entries = run_orm_inline("quill-const-infix", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "QUI-INJ-001"),
        0,
        "QUI-INJ-001 must NOT fire on constant infix"
    );
}

#[test]
fn quill_neg_transaction_wrapping_run() {
    // ctx.transaction { ctx.run(...) } — single execution. Not a loop.
    let src = r#"
package neg
import io.getquill._
class Repo(ctx: PostgresJdbcContext[SnakeCase]) {
  import ctx._
  case class P(id: Int)
  def tx() = ctx.transaction { ctx.run(quote { query[P] }) }
}
"#;
    let entries = run_orm_inline("quill-tx", "Repo.scala", src);
    assert_eq!(
        count_rule(&entries, "QUI-N1-002"),
        0,
        "QUI-N1-002 must NOT fire on ctx.transaction wrapping ctx.run"
    );
}

// ─── Exposed negatives ──────────────────────────────────────────────────

#[test]
fn exposed_neg_transaction_block_alone() {
    // `transaction { ... }` at top level is just a scope. No findings.
    let src = r#"
package neg
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.SchemaUtils
fun setup() {
  transaction { SchemaUtils.create(Users) }
}
"#;
    let entries = run_orm_inline("exposed-tx-top", "Setup.kt", src);
    assert_eq!(
        count_rule(&entries, "EXP-TXN-007"),
        0,
        "EXP-TXN-007 must NOT fire on top-level transaction"
    );
    assert_eq!(
        count_rule(&entries, "EXP-N1-001"),
        0,
        "EXP-N1-001 must NOT fire on top-level transaction"
    );
}

#[test]
fn exposed_neg_with_eager_loading() {
    // `.with(refs)` eager-loads. Lazy-ref rule must NOT fire.
    let src = r#"
package neg
import org.jetbrains.exposed.sql.transactions.transaction
fun good() {
  transaction {
    UserEntity.all().with(UserEntity::ratings).forEach { u ->
      u.ratings.forEach { r -> println(r.value) }
    }
  }
}
"#;
    let entries = run_orm_inline("exposed-with", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "EXP-LAZY-008"),
        0,
        "EXP-LAZY-008 must NOT fire when .with() is applied"
    );
}

#[test]
fn exposed_neg_batch_insert_with_inner_for() {
    // `Table.batchInsert(rows) { ... }` — the `for` inside builds items,
    // NOT a query-per-row.
    let src = r#"
package neg
import org.jetbrains.exposed.sql.transactions.transaction
fun good(rows: List<Pair<String, String>>) {
  transaction {
    UsersTable.batchInsert(rows) { (n, e) ->
      this[UsersTable.name] = n
      this[UsersTable.email] = e
    }
  }
}
"#;
    let entries = run_orm_inline("exposed-batch", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "EXP-INS-004"),
        0,
        "EXP-INS-004 must NOT fire on batchInsert"
    );
    assert_eq!(
        count_rule(&entries, "EXP-INS-006"),
        0,
        "EXP-INS-006 must NOT fire on batchInsert"
    );
}

#[test]
fn exposed_neg_safe_exec_with_args() {
    // `exec("…?", listOf(IntegerColumnType() to id))` — parameterized.
    // Must NOT fire EXP-RAW-003 (which targets string concat).
    let src = r#"
package neg
import org.jetbrains.exposed.sql.IntegerColumnType
import org.jetbrains.exposed.sql.transactions.transaction
fun good(id: Int) {
  transaction {
    exec("SELECT * FROM users WHERE id = ?", listOf(IntegerColumnType() to id))
  }
}
"#;
    let entries = run_orm_inline("exposed-safe-exec", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "EXP-RAW-003"),
        0,
        "EXP-RAW-003 must NOT fire on parameterized exec"
    );
}

// ─── Ktorm negatives ────────────────────────────────────────────────────

#[test]
fn ktorm_neg_useconnection_callback() {
    // `useConnection { conn -> ... }` is a callback. Body runs ONCE.
    let src = r#"
package neg
import org.ktorm.database.Database
fun good(db: Database, id: Int) {
  db.useConnection { conn ->
    conn.prepareStatement("SELECT * FROM users WHERE id = ?").use { st ->
      st.setInt(1, id)
      st.executeQuery()
    }
  }
}
"#;
    let entries = run_orm_inline("ktorm-useconn", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "KTO-N1-001"),
        0,
        "KTO-N1-001 must NOT fire on useConnection callback"
    );
    assert_eq!(
        count_rule(&entries, "KTO-RAW-002"),
        0,
        "KTO-RAW-002 must NOT fire on parameterized prepareStatement"
    );
}

#[test]
fn ktorm_neg_batch_insert() {
    // Canonical `database.batchInsert(Table) { for(x in xs) item { … } }`
    // is the FIX, must not fire KTO-INS-004.
    let src = r#"
package neg
import org.ktorm.database.Database
import org.ktorm.dsl.batchInsert
fun good(db: Database, users: List<User>) {
  db.batchInsert(Users) {
    for (u in users) {
      item {
        set(it.name, u.name)
      }
    }
  }
}
"#;
    let entries = run_orm_inline("ktorm-batch", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "KTO-INS-004"),
        0,
        "KTO-INS-004 must NOT fire on canonical batchInsert"
    );
}

#[test]
fn ktorm_neg_query_dsl_foreach_row() {
    // `database.from(...).select(...).forEach { row -> ... }` iterates
    // rows of ONE query. Not N+1.
    let src = r#"
package neg
import org.ktorm.database.Database
import org.ktorm.dsl.from
import org.ktorm.dsl.select
fun good(db: Database) {
  db.from(Users).select().forEach { row -> println(row[Users.name]) }
}
"#;
    let entries = run_orm_inline("ktorm-query-foreach", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "KTO-N1-001"),
        0,
        "KTO-N1-001 must NOT fire on row-mapping forEach over a Query"
    );
}

#[test]
#[allow(non_snake_case)]
fn ktorm_neg_grouping_eachCount() {
    // The CANONICAL fix for "count per X": one GROUP BY query.
    let src = r#"
package neg
import org.ktorm.database.Database
fun good(db: Database) {
  val counts = db.employees.groupingBy { it.departmentId }.eachCount()
}
"#;
    let entries = run_orm_inline("ktorm-groupby", "Good.kt", src);
    assert_eq!(
        count_rule(&entries, "KTO-N1-001"),
        0,
        "KTO-N1-001 must NOT fire on groupingBy().eachCount() (the fix)"
    );
}
