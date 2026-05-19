#!/usr/bin/env bash
# End-to-end smoke test for the driftdockerprofiler swap.
#
# Boots `app` + `obs` via docker compose, generates HTTP traffic,
# waits for the profiler's window to close, and asserts that:
#   1. The app starts and /healthz returns 200.
#   2. The shared volume's events.log gets populated.
#   3. Every emitted event carries the full schema (cpu, memory_bytes,
#      frames, etc.).
#   4. The observability-server's /events endpoint returns those events.
#   5. /live_logs streams data: frames over SSE.
#
# Tears the stack down at exit regardless of success/failure.
#
# Requires: docker compose, curl, jq, awk.

set -euo pipefail

cd "$(dirname "$0")"
COMPOSE="docker compose -f compose.yaml"
APP_URL="http://localhost:8000"
OBS_URL="http://localhost:8080"

# --- Colors ------------------------------------------------------------------
RED=$'\033[1;31m'; GREEN=$'\033[1;32m'; YELLOW=$'\033[1;33m'
BLUE=$'\033[1;34m'; CYAN=$'\033[1;36m'; RESET=$'\033[0m'

say() { printf "%s▶%s %s\n" "$BLUE" "$RESET" "$*"; }
ok()  { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$*"; }
bad() { printf "  %s✗%s %s\n" "$RED" "$RESET" "$*"; }

trap 'say "tearing down"; $COMPOSE down --volumes --remove-orphans >/dev/null 2>&1 || true' EXIT

# --- Pre-flight --------------------------------------------------------------
for bin in docker curl jq awk; do
  command -v "$bin" >/dev/null 2>&1 || { bad "missing dependency: $bin"; exit 2; }
done

# --- Step 1: build + boot ----------------------------------------------------
say "building app + obs images"
$COMPOSE build >/dev/null
ok "images built"

say "starting stack"
$COMPOSE up -d >/dev/null
ok "containers up"

# --- Step 2: wait for /healthz ----------------------------------------------
say "waiting for app /healthz to return 200 (up to 30 s)"
for i in $(seq 1 60); do
  if curl -fsS "$APP_URL/healthz" >/dev/null 2>&1; then
    ok "app healthy after $((i / 2)) s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    bad "app never reported healthy"
    $COMPOSE logs app | tail -50
    exit 1
  fi
  sleep 0.5
done

say "waiting for obs /health to return 200"
for i in $(seq 1 40); do
  if curl -fsS "$OBS_URL/health" >/dev/null 2>&1; then
    ok "obs healthy"
    break
  fi
  if [ "$i" -eq 40 ]; then
    bad "obs never reported healthy"
    $COMPOSE logs obs | tail -50
    exit 1
  fi
  sleep 0.5
done

# --- Step 3: generate workload (CONTINUOUSLY, in the background) ------------
# The profiler runs wall + cpu windows back-to-back, each
# DRIFT_DURATION_MS long. Wall sampling captures stacks even when idle
# (it's based on real time); CPU sampling only fires when the process
# is on-CPU. So we MUST keep work flowing through the wait window —
# otherwise no `cpu_trace` events get emitted, and that's the whole
# point of the C++ extension.
WORKLOAD_DURATION=14
say "starting continuous workload for ${WORKLOAD_DURATION}s in the background"

(
  end_time=$(( $(date +%s) + WORKLOAD_DURATION ))
  i=0
  while [ "$(date +%s)" -lt "$end_time" ]; do
    i=$((i + 1))
    curl -fsS -X POST "$APP_URL/orders" \
      -H "content-type: application/json" \
      -d "{\"customer_id\":\"c-$i\",\"items\":[{\"sku\":\"s-$i\",\"qty\":1}]}" \
      >/dev/null 2>&1 || true
    curl -fsS -X POST "$APP_URL/orders/o-$i/charge" \
      -H "content-type: application/json" \
      -d "{\"amount_value\":${i}.50,\"password\":\"hunter2\"}" \
      >/dev/null 2>&1 || true
    # No sleep — keep the python process on-CPU.
  done
) &
WORKLOAD_PID=$!
ok "workload generator pid=$WORKLOAD_PID"

# --- Step 4: wait for at least one wall window + one cpu window to flush ----
# DRIFT_DURATION_MS in compose.yaml = 2000 → 2 s/window. The agent
# alternates wall → cpu → wall → ..., so a full cycle is 4 s. We wait
# 12 s = 3 full cycles to be safe.
WAIT_S=12
say "waiting ${WAIT_S}s for wall + cpu windows to flush"
sleep "$WAIT_S"
wait "$WORKLOAD_PID" 2>/dev/null || true

# --- Step 5: assert events were written -------------------------------------
say "fetching /events from obs"
EVENTS_JSON=$(curl -fsS "$OBS_URL/events")
EVENT_COUNT=$(echo "$EVENTS_JSON" | jq 'length')

if [ "$EVENT_COUNT" -lt 1 ]; then
  bad "no events found in /events (got $EVENT_COUNT)"
  $COMPOSE logs app | tail -30
  $COMPOSE exec -T obs ls -la /trace 2>/dev/null || true
  exit 1
fi
ok "$EVENT_COUNT events in /events ring buffer"

# --- Step 6: schema assertions ----------------------------------------------
say "validating event schema (type/time/service/period_ns/duration_ns/count/cpu/memory_bytes/frames)"
REQUIRED='["type","time","service","period_ns","duration_ns","count","cpu","memory_bytes","frames"]'
MISSING=$(echo "$EVENTS_JSON" | jq -r --argjson req "$REQUIRED" \
  '[.[] | . as $e | $req[] | select($e[.] == null)] | unique | join(",")')
if [ -n "$MISSING" ]; then
  bad "events missing required keys: $MISSING"
  echo "$EVENTS_JSON" | jq '.[0]' >&2
  exit 1
fi
ok "every event carries the full schema"

# --- Step 7: event-type sanity ----------------------------------------------
WALL_COUNT=$(echo "$EVENTS_JSON" | jq '[.[] | select(.type=="wall_trace")] | length')
CPU_COUNT=$(echo "$EVENTS_JSON" | jq '[.[] | select(.type=="cpu_trace")] | length')
say "event types: wall_trace=$WALL_COUNT  cpu_trace=$CPU_COUNT"

if [ "$WALL_COUNT" -lt 1 ]; then
  bad "expected at least one wall_trace event"
  exit 1
fi
ok "wall sampler producing events"

# CPU sampler only runs on Linux containers — we're inside compose
# on linux/amd64 or linux/arm64, so it MUST be available.
if [ "$CPU_COUNT" -lt 1 ]; then
  bad "expected at least one cpu_trace event (the C++ extension is the whole point)"
  echo "$EVENTS_JSON" | jq '.[0]' >&2
  exit 1
fi
ok "C++ CPU sampler producing events"

# --- Step 8: SSE stream check ------------------------------------------------
say "checking /live_logs streams an event within 6 s"
# `curl --max-time` cuts the stream off after N seconds; we then check
# that we saw at least one `data:` frame. Fire a tiny workload alongside
# the read so a fresh window definitely flushes during the window.
( for i in $(seq 1 5); do curl -fsS -X POST "$APP_URL/orders" \
    -H "content-type: application/json" \
    -d '{"customer_id":"sse-trigger"}' >/dev/null 2>&1; sleep 0.4; done ) &
WORKER_PID=$!

SSE_OUT=$(curl --silent --max-time 6 "$OBS_URL/live_logs" 2>/dev/null || true)
wait "$WORKER_PID" 2>/dev/null || true

SSE_FRAMES=$(printf "%s" "$SSE_OUT" | grep -c '^data:' || true)
if [ "$SSE_FRAMES" -lt 1 ]; then
  bad "no SSE frames received over /live_logs"
  exit 1
fi
ok "received $SSE_FRAMES SSE data: frames"

# --- Step 9: print a sample event for the eyeball test ----------------------
say "sample event (first in ring buffer):"
echo "$EVENTS_JSON" | jq '.[0]' | sed 's/^/    /'

printf "\n%s═══════════════════════════════════════════════════════════════%s\n" "$GREEN" "$RESET"
printf "%s✓ e2e: driftdockerprofiler → observability-server is wired end-to-end%s\n" "$GREEN" "$RESET"
printf "%s═══════════════════════════════════════════════════════════════%s\n" "$GREEN" "$RESET"
