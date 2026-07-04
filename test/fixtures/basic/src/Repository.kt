package com.example

const val MAX_RESULTS = 50

typealias RowMapper = (String) -> Entity

class Entity(val id: String)

class Repository(private val connection: String) {
    val cache = mutableMapOf<String, Entity>()

    fun findById(id: String): Entity? {
        return cache[id]
    }

    fun save(entity: Entity) {
        cache[entity.id] = entity
    }
}

object ConnectionPool {
    fun acquire(): String = "conn"
}

interface Auditable {
    fun auditLog(): String
}

enum class Status { ACTIVE, DELETED }

fun topLevelHelper(x: Int): Int = x * 2
