# test-python-web-server

FastAPI app profiled by
[`driftdockerprofiler`](../drift-profiler-python/) (wall-clock SIGALRM
sampler + CPU SIGPROF sampler via a compiled C++ extension). JSONL
events go to `/trace/events.log` — an `emptyDir(medium=Memory)` volume
shared with the observability-server container in the same pod (under
Tilt + minikube) or a docker compose `volume` (under the e2e target).

Replaces the old `drift-python` trace-agent integration. See
[the e2e compose stack](e2e/compose.yaml) and the
[smoke test](e2e/smoke_test.sh) for the canonical wiring.

## Build (from repo root)

```bash
# 1) Build the wheel (the C++ extension needs gcc/g++ → it's built
#    inside python:3.11, then copied out as a .whl).
make wheel-driftdockerprofiler

# 2) Build the app image (depends on the wheel).
make images-app
```

`make images-app` already declares the wheel as a prerequisite, so a
single `make images-app` from a clean checkout does both. Tilt does
the equivalent via the `driftdockerprofiler-wheel` local_resource — see
[dev/Tiltfile](../dev/Tiltfile).

## Run end-to-end in Docker (no minikube needed)

```bash
make e2e-driftdockerprofiler
```

Spins up `app` + `obs` in a compose stack wired through a shared
volume, generates HTTP traffic, and asserts that:

  - `/trace/events.log` fills with JSONL lines,
  - every event carries the new schema
    (`type` / `time` / `service` / `period_ns` / `duration_ns` / `count` /
    `cpu` / `memory_bytes` / `frames`),
  - **both `wall_trace` AND `cpu_trace` events appear** — meaning the
    bundled `_profiler.so` C++ extension fires under load (this is the
    whole point of the wheel),
  - `/live_logs` (SSE) emits `data:` frames.

Tears the stack down on exit. Takes ~30–45 s end-to-end.

## Endpoints

| Method | Path                  | Calls                              |
| ------ | --------------------- | ---------------------------------- |
| GET    | `/healthz`            |                                    |
| POST   | `/orders`             | `OrderService.create`              |
| POST   | `/orders/{id}/charge` | `OrderService.charge` (async)      |
| POST   | `/orders/{id}/ship`   | `OrderService.ship`                |

## Knobs (all env vars; defaults baked into [app.py](app.py))

| Env var              | Default                         | Effect                                                  |
| -------------------- | ------------------------------- | ------------------------------------------------------- |
| `DRIFT_SERVICE`      | `test-python-web-server`        | Service label stamped on every event                    |
| `DRIFT_EVENTS_PATH`  | `/trace/events.log`             | JSONL output path (must match `TRACE_PATH` on obs side) |
| `DRIFT_PERIOD_MS`    | `10`                            | Sampling interval (ms) — same for wall and CPU          |
| `DRIFT_DURATION_MS` | `10000`                          | Profile-window length (ms)                              |
| `DRIFT_EMIT_MODE`    | `per_trace`                     | `per_trace` (one event per unique stack) or `bundle` (one event per window with all samples inline) |

## What an event looks like

`per_trace` (default) emits one JSONL line per unique stack per window:

```json
{
  "type": "cpu_trace",
  "time": "2026-05-19T12:34:50.012345Z",
  "service": "test-python-web-server",
  "pod": "test-python-web-server-7d4c-xkqzn",
  "period_ns": 10000000,
  "duration_ns": 10000000000,
  "count": 42,
  "cpu": 0.42,
  "memory_bytes": 87654321,
  "frames": [
    {"name": "create", "file": "/app/orders.py", "line": 18},
    {"name": "create_order", "file": "/app/app.py", "line": 52}
  ]
}
```

See [observability-server/internal/api/web/openapi.yaml](../observability-server/internal/api/web/openapi.yaml)
for the full schema (`wall_trace` / `cpu_trace` / `wall_profile` /
`cpu_profile`).
