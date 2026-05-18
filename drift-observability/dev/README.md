# dev

Local cluster harness for the drift demo.

## Setup

```bash
make install        # brew installs minikube, kubectl, tilt, helm, k9s
                    # + checks Docker has >= 12 GiB / 10 CPUs
```

## Run

```bash
make up
```

This starts minikube if needed, then `tilt up`. Tilt builds both images in
parallel and renders [deploy/drift-demo](../deploy/drift-demo/) into the
`local` namespace. Two **Tilt resources** appear in the sidebar:

- **`observability-server`** — Go server (Deployment `demo-obs`, Service `demo-obs`)
- **`test-python-web-server`** — FastAPI app (Deployment `demo-app`, Service `demo-app`)

`test-python-web-server` waits for `observability-server` to be ready so the
first events succeed; if app starts first, drift just logs and retries.

## URLs

| URL                                  | What                                             |
| ------------------------------------ | ------------------------------------------------ |
| http://localhost:8000/docs           | **FastAPI** Swagger — exercise traced methods    |
| http://localhost:8080/docs/          | **observability-server** Swagger UI              |
| http://localhost:8080/live           | Live SSE viewer in the browser                   |
| http://localhost:8080/events         | JSON snapshot of recent events                   |

## Down

| Command              | Effect                                          |
| -------------------- | ----------------------------------------------- |
| `make down`          | `tilt down` — cluster stays                     |
| `make stop`          | Stop minikube (state preserved)                 |
| `make reset-data`    | Delete PVCs in `local` (no PVCs in this demo)   |
| `make nuke`          | `tilt down` + `minikube delete`                 |
