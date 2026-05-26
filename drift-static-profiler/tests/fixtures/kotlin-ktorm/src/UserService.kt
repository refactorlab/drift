package com.example

import org.ktorm.database.Database
import org.ktorm.dsl.*
import org.ktorm.entity.Entity
import org.ktorm.entity.find
import org.ktorm.entity.first
import org.ktorm.entity.sequenceOf
import org.ktorm.schema.Table
import org.ktorm.schema.int
import org.ktorm.schema.varchar

interface User : Entity<User> {
    companion object : Entity.Factory<User>()
    val id: Int
    var name: String
    var email: String
}

object Users : Table<User>("users") {
    val id    = int("id").primaryKey().bindTo { it.id }
    val name  = varchar("name").bindTo { it.name }
    val email = varchar("email").bindTo { it.email }
}

val Database.users get() = this.sequenceOf(Users)

class UserService(private val database: Database) {

    // Negative: single find — no findings expected.
    fun showUser(id: Int) = database.users.find { it.id eq id }

    // KTO-N1-001: sequence find inside a for loop.
    fun loadAll(ids: List<Int>) {
        for (id in ids) {
            database.users.find { it.id eq id }
        }
    }

    // KTO-N1-001: sequence first inside forEach.
    fun loadAllForeach(ids: List<Int>) {
        ids.forEach { id ->
            database.users.first { it.id eq id }
        }
    }

    // KTO-RAW-002: useConnection with prepareStatement string concat.
    fun searchUnsafe(name: String) {
        database.useConnection { conn ->
            conn.prepareStatement("SELECT * FROM users WHERE name = '" + name + "'")
        }
    }

    // KTO-UPD-003: per-entity flushChanges in a loop.
    fun raiseSalaries(users: List<User>) {
        users.forEach { u ->
            // u.salary += 100 -- omitted; just exercises flushChanges
            u.flushChanges()
        }
    }

    // KTO-INS-004: database.insert inside a loop.
    fun createMany(names: List<String>) {
        for (n in names) {
            database.insert(Users) {
                set(it.name, n)
                set(it.email, "$n@example.com")
            }
        }
    }

    // KTO-DEL-005: per-entity delete in a loop.
    fun purge(users: List<User>) {
        users.forEach { u -> u.delete() }
    }

    // Negative: canonical batch insert.
    fun createManyGood(names: List<String>) {
        database.batchInsert(Users) {
            for (n in names) {
                item {
                    set(it.name, n)
                    set(it.email, "$n@example.com")
                }
            }
        }
    }

    // Negative: useTransaction is a callback, NOT a loop.
    fun transactional(id: Int) {
        database.useTransaction {
            database.users.find { it.id eq id }
        }
    }

    // Negative: useConnection is a callback, NOT a loop.
    fun raw(id: Int) {
        database.useConnection { conn ->
            conn.prepareStatement("SELECT * FROM users WHERE id = ?").use { st ->
                st.setInt(1, id)
                st.executeQuery()
            }
        }
    }

    // Negative: bulk find via `inList`.
    fun loadAllGood(ids: List<Int>) {
        database.users.filter { it.id inList ids }.toList()
    }
}
