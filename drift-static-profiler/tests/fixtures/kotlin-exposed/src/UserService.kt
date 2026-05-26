package com.example

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction

object UsersTable : IntIdTable("users") {
    val name   = varchar("name", 64)
    val email  = varchar("email", 128)
    val active = bool("active")
}

class UserEntity(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<UserEntity>(UsersTable)
    var name   by UsersTable.name
    var email  by UsersTable.email
    var active by UsersTable.active
}

class UserService {

    // Negative: single findById in a transaction — no findings expected.
    fun showUser(id: Int) = transaction { UserEntity.findById(id) }

    // EXP-N1-001: findById inside forEach — N+1.
    fun loadAll(ids: List<Int>) {
        transaction {
            ids.forEach { id -> UserEntity.findById(id) }
        }
    }

    // EXP-N1-002: DAO find inside a loop.
    fun searchEach(emails: List<String>) {
        transaction {
            for (e in emails) {
                UserEntity.find { UsersTable.email eq e }.firstOrNull()
            }
        }
    }

    // EXP-RAW-003: exec with string concat.
    fun searchUnsafe(name: String) {
        transaction {
            exec("SELECT * FROM users WHERE name = '" + name + "'")
        }
    }

    // EXP-INS-004: Entity.new inside a loop.
    fun createMany(names: List<String>) {
        transaction {
            for (n in names) {
                UserEntity.new {
                    name   = n
                    email  = "$n@example.com"
                    active = true
                }
            }
        }
    }

    // EXP-DEL-005: per-entity delete in a loop.
    fun purge() {
        transaction {
            UserEntity.all().forEach { it.delete() }
        }
    }

    // EXP-INS-006: DSL Table.insert inside a loop.
    fun bulkInsertWrong(rows: List<Pair<String, String>>) {
        transaction {
            for ((name, email) in rows) {
                UsersTable.insert {
                    it[UsersTable.name]   = name
                    it[UsersTable.email]  = email
                    it[UsersTable.active] = true
                }
            }
        }
    }

    // EXP-TXN-007: transaction { } inside a loop — N connections.
    fun deleteEach(ids: List<Int>) {
        ids.forEach { id ->
            transaction {
                UsersTable.deleteWhere { UsersTable.id eq id }
            }
        }
    }

    // Negative: canonical batch insert — single statement.
    fun bulkInsertGood(rows: List<Pair<String, String>>) {
        transaction {
            UsersTable.batchInsert(rows) { (name, email) ->
                this[UsersTable.name]   = name
                this[UsersTable.email]  = email
                this[UsersTable.active] = true
            }
        }
    }

    // Negative: bulk find via `inList`.
    fun loadAllGood(ids: List<Int>) {
        transaction {
            UserEntity.find { UsersTable.id inList ids }.toList()
        }
    }

    // Negative: bulk delete.
    fun purgeGood() {
        transaction {
            UsersTable.deleteWhere { UsersTable.active eq false }
        }
    }

    // EXP-LAZY-008: lazy reference access inside a forEach over Entity.all().
    // Each iteration triggers a query for `user.ratings`. The fix is
    // `.with(UserEntity::ratings)` on the outer query.
    fun lazyRatingsBad() {
        transaction {
            UserEntity.all().forEach { user ->
                user.ratings.forEach { r -> println(r.value) }
            }
        }
    }

    // Negative: eager-loaded with `.with(...)` — single batched IN query.
    fun lazyRatingsGood() {
        transaction {
            UserEntity.all().with(UserEntity::ratings).forEach { user ->
                user.ratings.forEach { r -> println(r.value) }
            }
        }
    }
}
