package app

import io.getquill._
import io.getquill.context.jdbc._

case class Person(id: Int, name: String, age: Int)

class UsersService(ctx: PostgresJdbcContext[SnakeCase]) {
  import ctx._

  // Negative: simple quote + run — no findings expected.
  def listAll() = ctx.run(quote { query[Person] })

  // QUI-N1-002: ctx.run inside a Scala collection for-comprehension.
  def n1ByFor(ids: List[Int]) = {
    for (id <- ids) yield ctx.run(quote {
      query[Person].filter(_.id == lift(id))
    })
  }

  // QUI-N1-002: ctx.run inside .foreach.
  def n1ByForeach(people: List[Person]): Unit = {
    people.foreach { p =>
      ctx.run(quote { query[Person].insertValue(lift(p)) })
    }
  }

  // QUI-N1-002: ctx.run inside .map (collection map).
  def n1ByMap(ids: List[Int]) = {
    ids.map { id =>
      ctx.run(quote { query[Person].filter(_.id == lift(id)) })
    }
  }

  // Negative: the CORRECT batch — liftQuery(xs).foreach INSIDE quote { }.
  // The .foreach here is a Quoted expression, not a Scala collection
  // iteration. Must NOT trigger QUI-N1-002.
  def batchInsertGood(people: List[Person]) = {
    val q = quote {
      liftQuery(people).foreach(p => query[Person].insertValue(p))
    }
    ctx.run(q)
  }

  // QUI-INJ-001: infix"... $x ..." with non-lift interpolation.
  def searchUnsafe(name: String) = {
    ctx.run(quote {
      query[Person].filter(p => infix"p.name = '$name'".as[Boolean])
    })
  }

  // Negative: pure literal infix — no interpolation slot.
  def alwaysTrue() = quote {
    query[Person].filter(_ => infix"TRUE".as[Boolean])
  }

  // QUI-DYN-003: dynamicQuerySchema with a runtime table name.
  def dynamicSchemaUnsafe(tbl: String) = {
    ctx.run(dynamicQuerySchema[Person](tbl))
  }

  // Negative: dynamicQuerySchema with a literal table name.
  def dynamicSchemaSafe() = {
    ctx.run(dynamicQuerySchema[Person]("people"))
  }

  // QUI-DYN-003: set(col, ...) with a runtime column name.
  def dynamicSetUnsafe(col: String) = {
    dynamicQuery[Person].filter(_.id == 1).update(set(col, quote("x")))
  }

  // Negative: set(_.col, value) lambda form — safe.
  def dynamicSetSafe() = {
    dynamicQuery[Person].filter(_.id == 1).update(set(_.name, quote("x")))
  }
}
