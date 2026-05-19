"""Plain domain class — `@trace` makes its methods visible in profiles.

The methods here are ~µs fast. The statistical sampler in
driftdockerprofiler can't catch them (P ≈ duration / sample_period ≈
0.03 % per call at the default 10 ms period). `@trace` is the
opt-in deterministic tracer that emits one `function_call` event per
call regardless of duration. ~5 µs overhead per decorated call.
"""
from __future__ import annotations

import asyncio
import random
import uuid
import time



class OrderService:
    def __init__(self) -> None:
        self._db: dict = {}

    def create(self, order_id: str, customer: dict, items: list) -> dict:
        time.sleep(5)
        self._db[order_id] = {"id": order_id, "customer": customer, "items": items}
        return {"transactionId": "tx-" + uuid.uuid4().hex[:8], "status": "ok"}

    async def charge(self, order_id: str, amount: dict, password: str) -> dict:
        await asyncio.sleep(0.005)
        if random.random() < 0.1:
            raise RuntimeError(f"payment declined for {order_id}")
        return {"transactionId": "tx-" + uuid.uuid4().hex[:8], "status": "ok"}

    def ship(self, order_id: str) -> dict:
        return {"transactionId": "tx-" + uuid.uuid4().hex[:8], "status": "ok"}
