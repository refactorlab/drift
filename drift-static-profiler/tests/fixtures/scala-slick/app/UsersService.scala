package app

import slick.jdbc.PostgresProfile.api._
import scala.concurrent.{Await, Future}
import scala.concurrent.duration.Duration
import scala.concurrent.ExecutionContext.Implicits.global

case class User(id: Int, name: String, email: String)
case class Order(id: Int, userId: Int, total: Long)

class Users(tag: Tag) extends Table[(Int, String, String)](tag, "users") {
  def id    = column[Int]("id", O.PrimaryKey)
  def name  = column[String]("name")
  def email = column[String]("email")
  def *     = (id, name, email)
}

class Orders(tag: Tag) extends Table[(Int, Int, Long)](tag, "orders") {
  def id     = column[Int]("id", O.PrimaryKey)
  def userId = column[Int]("user_id")
  def total  = column[Long]("total")
  def *      = (id, userId, total)
}

class UsersService(db: Database) {
  val users  = TableQuery[Users]
  val orders = TableQuery[Orders]

  // Negative: simple compose-then-run — no findings expected.
  def showUsers(): Future[Seq[(Int, String, String)]] = db.run(users.result)

  // SLI-N1-002: db.run inside a Scala collection for-comprehension.
  def loadAll(ids: Seq[Int]): Seq[Future[Seq[(Int, String, String)]]] = {
    for (id <- ids) yield db.run(users.filter(_.id === id).result)
  }

  // SLI-N1-002: db.run inside .foreach.
  def deleteEach(ids: Seq[Int]): Unit = {
    ids.foreach { id =>
      db.run(users.filter(_.id === id).delete)
    }
  }

  // SLI-N1-002: db.run inside .map (Future.sequence variant).
  def fetchEach(ids: Seq[Int]): Future[Seq[Seq[(Int, String, String)]]] = {
    Future.sequence(ids.map { id =>
      db.run(users.filter(_.id === id).result)
    })
  }

  // SLI-INJ-001: `#$` literal interpolation.
  def searchUnsafe(name: String) = {
    db.run(sql"SELECT * FROM users WHERE name = '#$name'".as[(Int, String, String)])
  }

  // Negative: same query but with safe `$` parameter binding.
  def searchSafe(name: String) = {
    db.run(sql"SELECT * FROM users WHERE name = $name".as[(Int, String, String)])
  }

  // SLI-COMP-003: multiple sequential db.run calls.
  def transfer(fromId: Int, toId: Int, amount: Long): Unit = {
    val a = db.run(users.filter(_.id === fromId).map(_.name).update("debited"))
    val b = db.run(users.filter(_.id === toId).map(_.name).update("credited"))
  }

  // Negative: composed DBIO is fine (no SLI-COMP-003).
  def transferGood(fromId: Int, toId: Int, amount: Long): Future[Unit] = {
    val combined = DBIO.seq(
      users.filter(_.id === fromId).map(_.name).update("debited"),
      users.filter(_.id === toId).map(_.name).update("credited")
    ).transactionally
    db.run(combined)
  }

  // SLI-BLK-004: Await.result(db.run(...)) inside a loop.
  def blockingLoop(ids: Seq[Int]): Seq[Seq[(Int, String, String)]] = {
    ids.map { id =>
      Await.result(db.run(users.filter(_.id === id).result), Duration.Inf)
    }
  }

  // Negative: Slick monadic JOIN for-comprehension — QUERY composition,
  // NOT iteration. Must not trigger SLI-N1-002 even though it's a `for`.
  val joined = for {
    u <- users
    o <- orders if o.userId === u.id
  } yield (u.name, o.total)

  // Negative: db.run wrapping a DBIO for-comprehension — single round trip.
  def countAndCleanup(): Future[Int] = {
    db.run(for {
      n <- users.length.result
      _ <- users.filter(_.name === "obsolete").delete
    } yield n)
  }

  // SLI-TXN-005: db.run on multi-write DBIO.seq WITHOUT .transactionally.
  def transferNoTxn(fromId: Int, toId: Int): Future[Unit] = {
    db.run(DBIO.seq(
      users.filter(_.id === fromId).map(_.name).update("debited"),
      users.filter(_.id === toId).map(_.name).update("credited")
    ))
  }
}
