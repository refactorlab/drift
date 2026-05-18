"""Async, non-blocking JSONL writer.

Pipeline
--------

    caller thread:  emit(event_dict) ── put_nowait(dict)
                                          │  (drop on full)
                                          ▼
    writer thread:    get() (blocks) ─► batch-drain via get_nowait ─►
                                       serialize (ns→ISO, json.dumps) ─►
                                       sink(payloads)

Hot-path design
---------------

Serialization happens on the *drain thread*, NOT the caller thread. The
event dict is built once in the wrapper and never touched again, so
deferring `json.dumps` is safe and saves ~3-5 μs/call on the caller. The
caller's only cost is `put_nowait(dict)` (~0.5 μs) plus the closed-check.

Effective-Python notes
----------------------

* `queue.Queue` (bounded) gives backpressure via drop-on-full.
* Shutdown is a sentinel on the queue, not a polling Event. Drainer blocks
  on `get()` — zero CPU when idle (Slatkin Item 54).
* Batch drain: one blocking `get()`, then drain via `get_nowait` and hand
  the whole batch to the sink in one call.
* `_closed` is a `threading.Event` — atomic test-and-set, safe under
  Python 3.13 free-threaded mode.
"""
from __future__ import annotations

import json
import logging
import queue
import threading
from datetime import datetime, timezone
from typing import Any

# Final: stdlib on Python 3.8+ (3.8, 3.9, 3.10, 3.11, 3.12, 3.13); the
# typing_extensions backport is only needed on Python 3.7 where typing.Final
# does not exist. typing_extensions.Final on 3.8+ is a re-export of the
# stdlib symbol, so the fallback path stays behaviorally identical.
try:
    from typing import Final
except ImportError:  # Python 3.7
    from typing_extensions import Final

from .sinks import Sink

logger = logging.getLogger("drift.writer")

_QUEUE_SIZE: Final = 10_000
_CLOSE_TIMEOUT_S: Final = 2.0
_SHUTDOWN: Final = object()  # identity-compared sentinel


def _ns_to_iso(ns: int) -> str:
    """Convert integer nanoseconds since epoch to ISO-8601 UTC with 'Z'."""
    return (
        datetime.fromtimestamp(ns / 1_000_000_000, tz=timezone.utc)
        .isoformat(timespec="microseconds")
        .replace("+00:00", "Z")
    )


def _serialize(event: dict[str, Any]) -> bytes:
    """Drain-thread serializer: ns→ISO, then compact JSON + newline."""
    t = event.get("time")
    if isinstance(t, int):
        event["time"] = _ns_to_iso(t)
    return json.dumps(event, separators=(",", ":"), default=str).encode("utf-8") + b"\n"


class Writer:
    """Bounded-queue + daemon-thread JSONL writer.

    `emit()` is non-blocking and thread-safe; events are dropped (counted via
    `dropped`) when the queue is full.
    """

    def __init__(self, sink: Sink) -> None:
        self._sink = sink
        self._queue: queue.Queue[Any] = queue.Queue(maxsize=_QUEUE_SIZE)
        self._drop_lock = threading.Lock()
        self._dropped = 0
        self._closed = threading.Event()
        self._thread = threading.Thread(
            target=self._drain, name="drift-writer", daemon=True,
        )
        self._thread.start()

    # ----------------------------------------------------------------- public

    def emit(self, event: dict[str, Any]) -> None:
        """Enqueue one event. Never blocks; drops on overflow. ~0.5 μs."""
        if self._closed.is_set():
            return
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            self._inc_dropped()

    @property
    def dropped(self) -> int:
        with self._drop_lock:
            return self._dropped

    def close(self, timeout: float = _CLOSE_TIMEOUT_S) -> None:
        if self._closed.is_set():
            return
        self._closed.set()
        try:
            self._queue.put(_SHUTDOWN, timeout=timeout)
        except queue.Full:  # pragma: no cover
            pass
        self._thread.join(timeout=timeout)

    def __enter__(self) -> "Writer":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    # --------------------------------------------------------------- internal

    def _drain(self) -> None:
        q = self._queue
        sink = self._sink
        try:
            while True:
                first = q.get()
                if first is _SHUTDOWN:
                    return
                batch: list[dict[str, Any]] = [first]
                try:
                    while True:
                        item = q.get_nowait()
                        if item is _SHUTDOWN:
                            self._flush(sink, batch)
                            return
                        batch.append(item)
                except queue.Empty:
                    pass
                self._flush(sink, batch)
        finally:
            try:
                sink.close()
            except Exception:  # pragma: no cover
                pass

    def _flush(self, sink: Sink, batch: list[dict[str, Any]]) -> None:
        """Serialize the batch and hand it to the sink. Per-event errors are
        logged and skipped — one bad event must not poison the batch."""
        payloads: list[bytes] = []
        for ev in batch:
            try:
                payloads.append(_serialize(ev))
            except (TypeError, ValueError) as e:
                logger.warning("event serialization failed: %s", e)
        if not payloads:
            return
        try:
            sink(payloads)
        except Exception as e:
            logger.error("sink error, %d events dropped: %s", len(payloads), e)

    def _inc_dropped(self) -> None:
        with self._drop_lock:
            self._dropped += 1
