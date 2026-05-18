# drift-observability

Minimal method-level tracing for Python services, deployed as two independent
Kubernetes Deployments — like a real microservice topology, not a single pod.

```
┌─────────────────────────────────┐            ┌─────────────────────────────────┐
│ Deployment: drift-demo-app      │            │ Deployment: drift-demo-obs      │
│   test-python-web-server        │            │   observability-server          │
│   FastAPI :8000                 │            │   Go :8080                      │
│    • /docs (Swagger)            │            │    • POST /ingest               │
│    • POST /orders, /charge, /ship           ─┼───▶ • /live_logs (SSE)          │
│    • drift wraps OrderService   │  HTTP      │    • /events (snapshot)         │
│    • HTTP sink → ─ ─ ─ ─ ─ ─ ─ ─│ via DNS    │    • /docs/ (Swagger UI)        │
│                                 │            │    • /live (browser viewer)     │
└────────┬────────────────────────┘            └────────┬────────────────────────┘
         │ Service: drift-demo-app                      │ Service: drift-demo-obs
         ▼                                              ▼
    localhost:8000                                 localhost:8080
```

## Components

| Path                       | What it is                                            |
| -------------------------- | ----------------------------------------------------- |
| `drift-python/`            | `drift` pip package (built as a wheel)                |
| `test-python-web-server/`  | FastAPI app; Dockerfile installs the drift wheel      |
| `observability-server/`    | Go server: `/ingest`, `/live_logs`, `/docs`, `/events` |
| `deploy/drift-demo/`       | Helm chart — two Deployments + two Services           |
| `dev/`                     | Tiltfile + Makefile entry points                      |

## Quickstart

```bash
make install        # one-time: brew installs minikube, kubectl, tilt, helm, k9s
make up             # starts minikube, runs `tilt up`
```

Two Tilt resources appear in the sidebar (`observability-server`, `test-python-web-server`).
Once both are green:

| URL                                 | What                                              |
| ----------------------------------- | ------------------------------------------------- |
| http://localhost:8000/docs          | **FastAPI** Swagger — fire calls into the app     |
| http://localhost:8080/docs/         | **observability-server** Swagger UI               |
| http://localhost:8080/live          | Live SSE viewer in the browser                    |
| http://localhost:8080/events        | JSON snapshot of recent events                    |

## What happens when you POST `/orders`

1. FastAPI calls `OrderService.create(...)`.
2. The drift wrapper emits a `phase: "start"` event (with redacted params,
   defining file, caller's file:line), runs the original, then emits a
   `phase: "end"` event sharing the same `call` UUID, with `status` and
   `duration_ms`.
3. drift's `FileSink` appends each JSONL line to `/trace/events.log`
   on a shared hostPath volume.
4. observability-server's tailer reads each new line, pushes it to the
   in-memory broadcaster (ring buffer + SSE fan-out).
5. http://localhost:8080/live (SSE) shows the events appearing in real time.

## Event format

Two events per call, same `call` id (process-local int counter). Start
carries params; both events carry the caller's `file` + `line`. End carries
timing/status. There is **no `phase` field** — consumers tell them apart by
content (`params` present → start, `duration_ms` present → end).

```json
{
  "call":     42,
  "qualname": "orders.OrderService.create",
  "service":  "test-python-web-server",
  "pod":      "demo-app-<hash>",
  "file":     "/app/app.py",
  "line":     55,
  "params":   {"customer": {"id": "c-1", "tier": "standard"}, "password": "***"},
  "time":     "2026-05-18T..."
}
{
  "call":        42,
  "qualname":    "orders.OrderService.create",
  "service":     "test-python-web-server",
  "pod":         "demo-app-<hash>",
  "file":        "/app/app.py",
  "line":        55,
  "time":        "2026-05-18T...",
  "status":      "ok",
  "duration_ms": 1.23
}
```

On exception, the end event has `status: "error"` and `error: "<Type>: <msg>"`.

### Trimming events with `include:`

```yaml
include:
  pod: true
  service: true
  caller: true   # caller's file + line (off → drops both fields on every event)
```

## Tests

```bash
make test-drift     # unit tests for drift (file sink + HTTP sink)
make wheel          # builds drift-0.1.0-py3-none-any.whl
make images         # builds both Docker images
```
