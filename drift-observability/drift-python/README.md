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
log_path: drift/logs/events.log
redact: [password, token, secret]
methods:
  - orders.OrderService.create              # capture all kwargs
  - orders.OrderService.charge
  - target: orders.OrderService.ship        # capture only listed params
    params: [order_id]

# Optional: ship the local log file to S3 at end-of-run (atexit) or on
# SIGINT/SIGTERM. Backends are tried in order: boto3 → requests → urllib
# (stdlib), so no new dependency is required. Credentials fall back to the
# usual AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.
s3:
  bucket: my-bucket
  prefix: drift                 # optional object-key prefix
  region: us-east-1             # default
  # access_key_id / secret_access_key are optional; env vars used if omitted
```

Set `DRIFT_DISABLED=1` to install as a no-op.

## Test

```bash
pytest -q
```
