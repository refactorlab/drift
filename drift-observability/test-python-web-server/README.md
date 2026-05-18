# test-python-web-server

FastAPI app whose `OrderService` methods are wrapped by [`drift`](../drift-python/).
Events go to `/trace/events.log` — an `emptyDir(medium=Memory)` volume shared
with the observability-server container in the same pod.

## Build (from repo root)

```bash
docker build -f test-python-web-server/Dockerfile -t test-python-web-server:dev .
```

Tilt does this automatically — see [dev/Tiltfile](../dev/Tiltfile).

## Endpoints

| Method | Path                  | Calls                       |
| ------ | --------------------- | --------------------------- |
| GET    | `/healthz`            |                             |
| POST   | `/orders`             | `OrderService.create`       |
| POST   | `/orders/{id}/charge` | `OrderService.charge` (async) |
| POST   | `/orders/{id}/ship`   | `OrderService.ship`         |

## Knobs

| Env var          | Effect                                                          |
| ---------------- | --------------------------------------------------------------- |
| `DRIFT_CONFIG`   | Path to the trace config (default: `./trace-config.yaml`)       |
| `DRIFT_DISABLED` | Set to `1` to install as a no-op                                |
