# Event file format

`driftdockerprofiler` writes one append-only file: a UTF-8 **JSONL stream**
where each line is exactly one JSON object describing a profile event.

```
/tmp/drift/events.jsonl                              ← default
                                                       overrideable via
                                                       driftdockerprofiler.start(output_path=...)
                                                       or env DRIFT_EVENTS_PATH
```

In the test-python-web-server compose stack, the path is `/trace/events.log`
on a shared volume — the only thing that matters is that the writer and
reader agree on it.

## On-disk shape

```text
{"type":"wall_trace","time":"2026-05-19T12:34:50.012345Z",...,"frames":[...]}\n
{"type":"wall_trace","time":"2026-05-19T12:34:50.012345Z",...,"frames":[...]}\n
{"type":"cpu_trace", "time":"2026-05-19T12:35:00.034567Z",...,"frames":[...]}\n
```

- **One JSON object per line.** No commas between lines, no top-level array
  brackets. This is JSONL (a.k.a. NDJSON), not a JSON array.
- **Line terminator is a single `\n`.** No trailing comma. The last line is
  also `\n`-terminated.
- **UTF-8 throughout.** Non-ASCII bytes appear as `\uXXXX` escapes (compact
  ASCII-safe form chosen by `json.dumps(..., ensure_ascii=True)`).
- **Compact serialization.** `separators=(',', ':')` — no whitespace inside
  objects.

## File mode

Implemented in [`driftdockerprofiler.writer.JsonlWriter`](driftdockerprofiler/writer.py):

```python
self._file = open(self._path, 'a', buffering=1)
```

- `'a'` = **append-only**. Existing content is preserved across process
  restarts; the agent never rewinds or truncates.
- `buffering=1` = **line-buffered**. Each `\n`-terminated write flushes —
  readers tailing the file see complete events without waiting for an
  OS-level page flush.
- An exclusive lock around the `write(line) + write('\n')` pair
  guarantees that one event's bytes never interleave with another's
  *within the same process*.

## Atomicity across processes

Multiple processes writing to the same file under `O_APPEND` get
record-level interleaving on POSIX, provided each `write()` is smaller
than `PIPE_BUF` (4 KiB minimum, often 64 KiB on Linux). Events here are
~200–2_000 bytes — comfortably under the limit. You can run multiple
replicas of the same service all writing to one shared file without
locking.

A line that *is* near 4 KiB (e.g. a deeply nested bundle event with 100+
samples) could in principle split. If you need a hard guarantee, give
each replica its own file:

```python
driftdockerprofiler.start(
    output_path=f"/trace/events-{os.environ['HOSTNAME']}.jsonl",
    ...
)
```

The observability-server's tailer accepts a glob; point it at
`/trace/events-*.jsonl` and it tails them all.

## Schema

Every line decodes into exactly one of four shapes, distinguished by
the top-level `type`:

| `type`         | What it is                                                   |
| -------------- | ------------------------------------------------------------ |
| `wall_trace`   | Per-trace mode, wall sampler — one event per unique stack    |
| `cpu_trace`    | Per-trace mode, CPU sampler (C++ ext) — same shape           |
| `wall_profile` | Bundle mode, wall sampler — one event per window, all stacks |
| `cpu_profile`  | Bundle mode, CPU sampler — same shape                        |

`per_trace` mode produces N events per window (N = unique stacks),
`bundle` mode produces 1 event per window with all stacks inlined.
Switch via `driftdockerprofiler.start(emit_mode='per_trace'|'bundle')`.

### Common fields (every event)

| Field             | Type                            | Source                                                   |
| ----------------- | ------------------------------- | -------------------------------------------------------- |
| `type`            | enum string                     | The discriminator above                                  |
| `time`            | ISO-8601 UTC `YYYY-MM-DDTHH:MM:SS.ffffffZ` | `time.time_ns()` at window close            |
| `service`         | string                          | `start(service=...)`                                     |
| `service_version` | string (optional)               | `start(service_version=...)` or `$GAE_VERSION` / `$K_REVISION` |
| `pod`             | string                          | `$HOSTNAME` or `socket.gethostname()`                    |
| `period_ns`       | int                             | Sampling interval (10 ms default → `10_000_000`)         |
| `duration_ns`     | int                             | Profile window length                                    |
| `cpu`             | float                           | `os.getloadavg()[0]` at window close                     |
| `memory_bytes`    | int                             | Linux: `/proc/self/statm` × page_size; macOS: `getrusage().ru_maxrss` |

### Per-trace events (`wall_trace`, `cpu_trace`)

Add:

| Field    | Type          | Notes                                          |
| -------- | ------------- | ---------------------------------------------- |
| `count`  | int           | Ticks that hit this exact stack in the window  |
| `frames` | array<Frame>  | Call stack, leaf-first                         |

`Frame`:

```json
{ "name": "create_order", "file": "/app/app.py", "line": 52 }
```

### Bundle events (`wall_profile`, `cpu_profile`)

Add:

| Field           | Type            | Notes                                                              |
| --------------- | --------------- | ------------------------------------------------------------------ |
| `profile_type`  | `"wall"`\|`"cpu"`| Same info as `type` minus the `_profile` suffix                  |
| `time_ns`       | int             | Same instant as `time`, but as nanoseconds (pprof carryover)       |
| `sample_type`   | array<ValueType>| Two-element vector: `[(sample,count), (wall|cpu, nanoseconds)]`    |
| `samples`       | array<Sample>   | One element per unique stack                                       |
| `default_sample_type` | string\|null | Reserved (always null)                                          |
| `comment`       | array<string>   | Reserved (always [])                                               |

`Sample`:

```json
{
  "count": 5,
  "value_ns": 50000000,        // count * period_ns
  "frames": [/* leaf-first */],
  "labels": {}                  // reserved
}
```

The canonical machine-readable schema lives at
[`driftdockerprofiler/schemas/event.schema.json`](driftdockerprofiler/schemas/event.schema.json)
(JSON Schema Draft 2020-12) and [`driftdockerprofiler/schemas/openapi.json`](driftdockerprofiler/schemas/openapi.json)
(OpenAPI 3.1 JSON form, same shapes under `components.schemas`).
Both ship inside the wheel via `package_data` so consumers can load
them at runtime:

```python
import driftdockerprofiler, json, jsonschema
jsonschema.validate(event, driftdockerprofiler.event_schema())
```

## Concrete example — 5 events from one run

```jsonl
{"type":"wall_trace","time":"2026-05-19T12:34:50.012345Z","service":"test-python-web-server","pod":"test-python-web-server-7d4c-xkqzn","period_ns":10000000,"duration_ns":10000000000,"count":847,"cpu":0.42,"memory_bytes":87654321,"frames":[{"name":"select","file":"/usr/local/lib/python3.12/selectors.py","line":468},{"name":"_run_once","file":"/usr/local/lib/python3.12/asyncio/base_events.py","line":1936}]}
{"type":"wall_trace","time":"2026-05-19T12:34:50.012345Z","service":"test-python-web-server","pod":"test-python-web-server-7d4c-xkqzn","period_ns":10000000,"duration_ns":10000000000,"count":42, "cpu":0.42,"memory_bytes":87654321,"frames":[{"name":"create","file":"/app/orders.py","line":18},{"name":"create_order","file":"/app/app.py","line":52}]}
{"type":"wall_trace","time":"2026-05-19T12:34:50.012345Z","service":"test-python-web-server","pod":"test-python-web-server-7d4c-xkqzn","period_ns":10000000,"duration_ns":10000000000,"count":12, "cpu":0.42,"memory_bytes":87654321,"frames":[{"name":"charge","file":"/app/orders.py","line":43},{"name":"charge_order","file":"/app/app.py","line":63}]}
{"type":"cpu_trace", "time":"2026-05-19T12:35:00.034567Z","service":"test-python-web-server","pod":"test-python-web-server-7d4c-xkqzn","period_ns":10000000,"duration_ns":10000000000,"count":31, "cpu":0.55,"memory_bytes":88012544,"frames":[{"name":"create","file":"/app/orders.py","line":22},{"name":"create_order","file":"/app/app.py","line":52}]}
{"type":"cpu_trace", "time":"2026-05-19T12:35:00.034567Z","service":"test-python-web-server","pod":"test-python-web-server-7d4c-xkqzn","period_ns":10000000,"duration_ns":10000000000,"count":8,  "cpu":0.55,"memory_bytes":88012544,"frames":[{"name":"json_encode","file":"/usr/local/lib/python3.12/site-packages/starlette/responses.py","line":189}]}
```

Reading this: window ended at `12:34:50.012345Z`. The event loop's
`select()` accounted for 847 ticks (mostly idle — good). `create_order`
was on-stack for 42 ticks (≈420 ms wall-clock attributed). The next
window (`12:35:00…`) is the CPU sampler — same `create_order` got 31
ticks (≈310 ms of real CPU time, not just elapsed wall time).

## Reader recipes

### `tail -f` for live tracing

```bash
tail -F /tmp/drift/events.jsonl | jq -c 'select(.type == "cpu_trace") | .frames[0]'
```

### `jq` aggregation across a full window

```bash
# Top-10 hottest leaf frames in the trace file.
jq -s '[
  .[] | select(.type == "cpu_trace") |
  { leaf: (.frames[0] | "\(.name) @ \(.file):\(.line)"), count: .count }
] | group_by(.leaf) | map({leaf: .[0].leaf, total: (map(.count) | add)}) |
sort_by(-.total) | .[0:10]' /tmp/drift/events.jsonl
```

### Python validation

```python
import json, driftdockerprofiler

with open("/tmp/drift/events.jsonl") as f:
    for line in f:
        event = json.loads(line)
        driftdockerprofiler.validate_event(event)   # raises on schema drift
```

### Over the wire (SSE)

The observability-server in this repo tails the file and re-broadcasts
each event over `/live_logs` as a single SSE `data:` frame:

```
data: {"type":"wall_trace","time":"2026-05-19T12:34:50.012345Z",...}\n
\n
data: {"type":"cpu_trace","time":"2026-05-19T12:35:00.034567Z",...}\n
\n
```

Two newlines terminate each SSE frame (per the spec). Inside each frame
the payload is the JSONL line verbatim — no re-serialization.

## What this format is NOT

- **Not rotated.** The agent never truncates or rotates. Use `logrotate`
  or your container runtime's log rotation if you need it.
- **Not deduped.** Two windows can emit the same leaf-frame trace with
  different `count`s; that's intentional — counts are per-window.
- **Not ordered by stack depth or count.** Order within a window is
  whatever the C++ multiset / Python dict happened to iterate in.
  Sort downstream.
- **Not a database.** It's an append log. Replay it into ClickHouse /
  DuckDB / Postgres if you want indexing and queries.
