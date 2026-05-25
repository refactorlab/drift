"""Tiny bench fixture — exercises class def, instance method, module-level
construction, and inter-method dispatch. Shape mirrors
drift-observability/test-python-web-server but stripped to its skeleton
so the bench measures the scanner, not the application logic."""


class OrderService:
    def __init__(self):
        self._db = {}

    def create(self, order_id):
        self._db[order_id] = {"id": order_id}
        return self.format_result(order_id)

    def charge(self, order_id, amount):
        return self.format_result(order_id)

    def format_result(self, order_id):
        return {"transactionId": order_id}


service = OrderService()
service.create("o-1")
service.charge("o-1", 100)
