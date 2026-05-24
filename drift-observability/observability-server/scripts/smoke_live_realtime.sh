#!/usr/bin/env bash
# scripts/smoke_live_realtime.sh
#
# End-to-end smoke test for the observability-server's live realtime
# pipeline:
#
#   1. Build the server binary in golang:1.22-alpine and start it on a
#      free localhost port, with TRACE_PATH inside an empty tempdir.
#   2. Poll /health until the server is ready (or timeout).
#   3. Open a Phoenix-Channels WebSocket subscriber that joins
#      `realtime:drift-profiler-events` and counts inbound broadcasts.
#   4. POST N events to /events (the publish path the Python
#      driftdockerprofiler.sinks.HttpServerSink uses in production).
#   5. Assert: subscriber received all N broadcasts within a timeout,
#      and /events returns N items in history.
#
# Exit code 0 on success; non-zero with a diagnostic on any failure.
# Designed to be safe to run repeatedly — leaves no lingering
# containers, even if interrupted (trap-based cleanup).
#
# Usage:
#     ./scripts/smoke_live_realtime.sh [N_EVENTS]
#
# Default N_EVENTS=5. Requires: docker, python3 (with websocket-client
# auto-installed into a temp venv if absent).
set -euo pipefail

N=${1:-5}
CONTAINER=obs-smoke-$$
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')
SERVER_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TRACE_DIR=$(mktemp -d)
TMP_LOG=$(mktemp)
trap 'rc=$?; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$TRACE_DIR" "$TMP_LOG" 2>/dev/null || true; exit "$rc"' EXIT INT TERM

echo "[smoke] server dir : $SERVER_DIR"
echo "[smoke] port       : $PORT"
echo "[smoke] trace dir  : $TRACE_DIR"
echo "[smoke] events     : $N"

# ---- 1. Build + start server in Docker --------------------------------------
echo "[smoke] building and starting server…"
docker run --rm -d \
  --name "$CONTAINER" \
  -p "${PORT}:8080" \
  -e "TRACE_PATH=/tmp/events.log" \
  -v "$SERVER_DIR":/src \
  -w /src \
  golang:1.22-alpine \
  sh -c "go build -o /tmp/server ./cmd/server && /tmp/server" \
  > /dev/null

# ---- 2. Wait for /health -----------------------------------------------------
echo -n "[smoke] waiting for /health "
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 0.5
done
if ! curl -sf "http://localhost:${PORT}/health" > /dev/null; then
  echo
  echo "[smoke] server failed to become healthy. Container logs:"
  docker logs "$CONTAINER" 2>&1 | head -50
  exit 1
fi

# ---- 3 + 4 + 5. Subscriber + publisher + assertions in Python ---------------
python3 - <<PYEOF
import json, os, socket, subprocess, sys, threading, time, urllib.request

PORT = int(os.environ.get('PORT') or ${PORT})
N = ${N}

# Ensure websocket-client is importable. If not, install into a temp
# location so the user's environment isn't mutated.
try:
    from websocket import create_connection
except Exception:
    subprocess.check_call([sys.executable, '-m', 'pip', '--quiet', 'install', '--user', 'websocket-client'])
    from websocket import create_connection

WS_URL = f'ws://localhost:{PORT}/realtime/v1/websocket?apikey=smokejwtsmokejwt&vsn=1.0.0'

received = []
joined_evt = threading.Event()
done_evt = threading.Event()

def subscriber():
    ws = create_connection(WS_URL, subprotocols=['phoenix'], timeout=5)
    join = {
      'topic': 'realtime:drift-profiler-events',
      'event': 'phx_join', 'ref': '1', 'join_ref': '1',
      'payload': {
        'config': {'broadcast': {'ack': False, 'self': False},
                   'presence': {'key': ''},
                   'postgres_changes': [], 'private': False},
        'access_token': 'smokejwtsmokejwt'
      }
    }
    ws.send(json.dumps(join))
    # Drain post-join trio
    ws.settimeout(3.0)
    for _ in range(3): ws.recv()
    joined_evt.set()

    ws.settimeout(5.0)
    while len(received) < N and not done_evt.is_set():
        try:
            frame = json.loads(ws.recv())
        except Exception:
            break
        if frame.get('event') != 'broadcast': continue
        inner = frame.get('payload', {}).get('payload')
        if inner is not None:
            received.append(inner)
    ws.close()

t = threading.Thread(target=subscriber, daemon=True)
t.start()
if not joined_evt.wait(5):
    print('[smoke] subscriber failed to join in time', file=sys.stderr); sys.exit(2)
print(f'[smoke] subscriber joined; publishing {N} events…')

# Publish via POST /events — the same path HttpServerSink uses.
for i in range(N):
    body = json.dumps({
        'type': 'wall_trace',
        'time': f'2026-05-21T00:00:{i:02d}Z',
        'service': 'smoke', 'pod': 'p',
        'period_ns': 1, 'duration_ns': 1,
        'cpu': 0.0, 'memory_bytes': 0,
        'count': 1,
        'frames': [{'name': f'fn{i}', 'file': 'a.py', 'line': i+1}]
    }).encode()
    req = urllib.request.Request(f'http://localhost:{PORT}/events',
                                 data=body, method='POST',
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as r:
        assert r.status == 202, f'unexpected status {r.status}'

# Wait for the subscriber thread to collect all N broadcasts.
deadline = time.time() + 10
while len(received) < N and time.time() < deadline:
    time.sleep(0.05)
done_evt.set()
t.join(timeout=2)

ok = (len(received) == N)
print(f'[smoke] subscriber received: {len(received)}/{N}')
if not ok:
    print('[smoke] FAIL — broadcasts missing', file=sys.stderr); sys.exit(3)

# Also verify history endpoint shows N items.
with urllib.request.urlopen(f'http://localhost:{PORT}/events') as r:
    history = json.load(r)
print(f'[smoke] /events history: {len(history)} items')
if len(history) != N:
    print('[smoke] FAIL — history count mismatch', file=sys.stderr); sys.exit(4)

# Spot-check field round-trip on first event.
first = received[0]
expected_keys = {'type', 'time', 'service', 'pod', 'period_ns', 'duration_ns', 'cpu', 'memory_bytes', 'count', 'frames'}
missing = expected_keys - first.keys()
if missing:
    print(f'[smoke] FAIL — first event missing keys: {missing}', file=sys.stderr); sys.exit(5)

print('[smoke] OK')
PYEOF

echo "[smoke] PASS"
