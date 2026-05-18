"""FastAPI test app — exercises `drift` end-to-end."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import drift
from orders import OrderService

DRIFT_CONFIG = os.environ.get(
    "DRIFT_CONFIG",
    str(Path(__file__).parent / "trace-config.yaml"),
)
drift.install(DRIFT_CONFIG)

app = FastAPI(
    title="drift test-python-web-server",
    description=(
        "Sample FastAPI service whose `OrderService` methods are wrapped by "
        "drift. Each call emits start+end events to the observability-server "
        "configured via `DRIFT_ENDPOINT`. Use this Swagger UI to fire calls; "
        "watch them stream into [the observability-server live log viewer](http://localhost:8080/live)."
    ),
    version="0.1.0",
)
service = OrderService()


class CreateBody(BaseModel):
    customer_id: str
    customer_tier: str = "standard"
    items: list[dict] = []


class ChargeBody(BaseModel):
    amount_value: float
    amount_currency: str = "USD"
    password: str  # demonstrates redaction


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.post("/orders")
def create_order(body: CreateBody) -> dict:
    order_id = "o-" + uuid.uuid4().hex[:8]
    result = service.create(
        order_id=order_id,
        customer={"id": body.customer_id, "tier": body.customer_tier},
        items=body.items,
    )
    return result | {"order_id": order_id}


@app.post("/orders/{order_id}/charge")
async def charge_order(order_id: str, body: ChargeBody) -> dict:
    try:
        return await service.charge(
            order_id=order_id,
            amount={"value": body.amount_value, "currency": body.amount_currency},
            password=body.password,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=402, detail=str(e))


@app.post("/orders/{order_id}/ship")
def ship_order(order_id: str) -> dict:
    return service.ship(order_id=order_id)
