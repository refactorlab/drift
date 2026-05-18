# drift

Minimal method-tracing for Python services.

## Install (editable)

```bash
pip install -e ".[dev]"
```

## Build wheel

```bash
python -m build       # produces dist/drift-0.1.0-py3-none-any.whl
```

## Use

```python
import drift
drift.install("/etc/drift/config.yaml")
```

That's the whole API. After this line, every method listed in the config
is wrapped; each call emits two JSONL events:

```json
{"call":"<uuid>","method":"X.foo","params":{"a":1},"time":"...","phase":"start"}
{"call":"<uuid>","method":"X.foo","time":"...","phase":"end","status":"ok","duration_ms":1.2}
```

## Config

```yaml
service: my-service        # required — stamped on every event
log_path: /trace/events.log
redact: [password, token, secret]
methods:
  - orders.OrderService.create              # capture all kwargs
  - orders.OrderService.charge
  - target: orders.OrderService.ship        # capture only listed params
    params: [order_id]
```

Set `DRIFT_DISABLED=1` to install as a no-op.

## Test

```bash
pytest -q
```
