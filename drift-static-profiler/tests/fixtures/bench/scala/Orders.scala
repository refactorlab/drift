// Tiny bench fixture — class + methods + module-level construction.
// Shape parallels the Python fixture.

class OrderService {
  private val db = scala.collection.mutable.Map[String, String]()

  def create(orderId: String): String = {
    db.put(orderId, orderId)
    formatResult(orderId)
  }

  def charge(orderId: String, amount: Int): String = {
    formatResult(orderId)
  }

  private def formatResult(orderId: String): String = {
    "tx-" + orderId
  }
}

object Main {
  def main(args: Array[String]): Unit = {
    val service = new OrderService()
    service.create("o-1")
    service.charge("o-1", 100)
  }
}
