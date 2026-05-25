// Tiny bench fixture — class + methods + module-level construction.
// Shape parallels the Python fixture.

class OrderService {
    private val db = mutableMapOf<String, String>()

    fun create(orderId: String): String {
        db[orderId] = orderId
        return formatResult(orderId)
    }

    fun charge(orderId: String, amount: Int): String {
        return formatResult(orderId)
    }

    private fun formatResult(orderId: String): String {
        return "tx-$orderId"
    }
}

fun main() {
    val service = OrderService()
    service.create("o-1")
    service.charge("o-1", 100)
}
