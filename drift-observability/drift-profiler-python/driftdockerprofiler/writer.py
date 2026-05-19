"""Local JSONL writer.

Replaces the GCP transmission code from the original `client.py`. Each
profile window produces a dict of `{trace: count}` (one entry per
unique call stack seen during that window); this module turns each
entry into one JSONL line and appends it to a file under /tmp.

The path is opened in append mode, so multiple processes can write to
the same file without coordination (POSIX guarantees atomicity for
writes up to PIPE_BUF; our events are 200–2_000 bytes, well under the
4_096-byte minimum). The file is created on first use.

Schema of one event::

    {
      "type": "wall_trace" | "cpu_trace",
      "time": "2026-05-19T01:23:45.678901Z",
      "service": "...",
      "pod": "...",
      "period_ns": 10000000,
      "duration_ns": 10000000000,
      "count": 42,                            # samples in this window
      "frames": [                             # leaf-first
        {"name": "leaf", "file": "/app/x.py", "line": 12},
        ...
      ]
    }
"""

import datetime
import json
import logging
import os
import threading

logger = logging.getLogger(__name__)


# Default location for emitted events. Lives under /tmp so any process
# can write to it without permission setup; we add a `drift` namespace
# so the file isn't lost in a noisy /tmp.
DEFAULT_OUTPUT_PATH = '/tmp/drift/events.jsonl'


def default_output_path():
  """Return the default JSONL output path."""
  return DEFAULT_OUTPUT_PATH


def _ns_to_iso(ts_ns):
  """Convert integer nanoseconds-since-epoch to ISO-8601 UTC with 'Z'."""
  secs, ns = divmod(ts_ns, 1_000_000_000)
  return (datetime.datetime.fromtimestamp(secs, tz=datetime.timezone.utc)
          .replace(microsecond=ns // 1000)
          .isoformat(timespec='microseconds')
          .replace('+00:00', 'Z'))


class JsonlWriter:
  """Append-only JSONL writer with one lock around every write.

  We deliberately do NOT buffer or batch. The wall/CPU profilers emit a
  handful of events per window (one per unique trace), so the per-line
  syscall cost is negligible — under 100 µs at modern Linux kernels. A
  batched writer would pay that cost back in complexity (graceful
  close, atexit, dropped-on-overflow handling) without saving anything.
  """

  def __init__(self, path=None):
    self._path = path or DEFAULT_OUTPUT_PATH
    parent = os.path.dirname(self._path)
    if parent:
      os.makedirs(parent, exist_ok=True)
    # Open for append, line-buffered. Multiple processes writing to the
    # same file under O_APPEND get atomic record-level interleaving on
    # POSIX as long as each write is under PIPE_BUF (4 KiB).
    self._file = open(self._path, 'a', buffering=1)
    self._lock = threading.Lock()
    self._emitted = 0

  @property
  def path(self):
    return self._path

  @property
  def emitted(self):
    return self._emitted

  def emit(self, event):
    """Serialize one event to JSON and append a single line.

    Accepts integer `time` (nanoseconds since epoch) and rewrites it to
    ISO-8601 in place — same contract as drift's writer. If `time` is
    missing the writer fills in the current wall time.
    """
    t = event.get('time')
    if t is None:
      event['time'] = _ns_to_iso(_now_ns())
    elif isinstance(t, int):
      event['time'] = _ns_to_iso(t)
    line = json.dumps(event, separators=(',', ':'), default=str)
    with self._lock:
      self._file.write(line)
      self._file.write('\n')
      self._emitted += 1

  def flush(self):
    with self._lock:
      try:
        self._file.flush()
        os.fsync(self._file.fileno())
      except OSError:
        # The file might be closed by another path; we don't fight it.
        pass

  def close(self):
    with self._lock:
      try:
        self._file.flush()
        self._file.close()
      except OSError:
        pass


def _now_ns():
  """time.time_ns shim that works on all Python versions we support."""
  import time
  # time.time_ns is 3.7+; both branches of the supported range have it.
  return time.time_ns()


def frames_to_dicts(trace):
  """Convert a tuple of (name, file, line) tuples to a list of dicts.

  Both the wall profiler (Python) and CPU profiler (C++) produce
  traces in this shape; the JSONL form is the same for both so
  downstream consumers don't care which produced it.
  """
  return [{'name': f[0], 'file': f[1], 'line': f[2]} for f in trace]
