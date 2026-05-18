"""Plain domain class — the methods drift will wrap."""
from __future__ import annotations

import asyncio
import random
import uuid


class OrderService:
    def __init__(self) -> None:
        self._db: dict[str, dict] = {}

    def create(self, order_id: str, customer: dict, items: list[dict]) -> dict:
        self._db[order_id] = {"id": order_id, "customer": customer, "items": items}
        return {"transactionId": "tx-" + uuid.uuid4().hex[:8], "status": "ok"}

    async def charge(self, order_id: str, amount: dict, password: str) -> dict:
        await asyncio.sleep(0.005)
        if random.random() < 0.1:
            raise RuntimeError(f"payment declined for {order_id}")
        return {"transactionId": "tx-" + uuid.uuid4().hex[:8], "status": "ok"}

    def ship(self, order_id: str) -> dict:
        return {"transactionId": "tx-" + uuid.uuid4().hex[:8], "status": "ok"}
