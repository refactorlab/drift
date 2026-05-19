# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""Deterministic per-call tracer — opt-in `@trace` decorator.

WHY THIS EXISTS

The statistical sampler in `client.py` catches what's on-CPU at sample
time; methods faster than ~one sample period (10 ms default) are
effectively invisible because the chance they're caught mid-execution
is ~`duration / period`. A function that runs for 3 µs has ~0.03 %
chance of being sampled per call.

`@trace` is the orthogonal piece: it emits one event per CALL of
each decorated function, regardless of duration. Coexists with the
sampler in the same JSONL stream — consumers filter on the `type`
field. py-spy, Sentry, Datadog, OpenTelemetry all use this hybrid
model.

COST

Per decorated call: ~5 µs (2× `time.time_ns()` + 1 dict alloc + 1
`writer.emit`). Per undecorated call: 0 µs — there's literally no
code path that runs. If `Client.start()` has not been called the
emit is a no-op so decorated code stays cheap until profiling is on.

OUTPUT SHAPE

One JSONL line per call. Discriminator `type = "function_call"`:

    {
      "type": "function_call",
      "time": "2026-05-19T12:34:50.012345Z",
      "service": "test-python-web-server",
      "pod": "...",
      "service_version": "..." (optional),
      "qualname": "orders.OrderService.create",
      "file": "/app/orders.py",
      "line": 14,
      "duration_ns": 3284,
      "status": "ok"          // or "error" if the function raised
    }

Consumed by `event_log::aggregate` in the Tauri desktop as a
single-frame stack with `weight_us = duration_ns / 1000` — flows
into the same icicle chart the sampler events feed.

THREAD-SAFETY

The single shared state — `_state` — is configured ONCE per Client
lifetime (`_configure` called from `Client.start()`, cleared from
`Client.stop()`). Concurrent reads from arbitrary threads are safe
because Python attribute reads on a dict are atomic in CPython.

ASYNC

`@trace` detects async-def functions via `inspect.iscoroutinefunction`
and uses an `async def` wrapper for them. Duration measured is wall
time between first await of the wrapper and final return — which
INCLUDES off-CPU time (sleeps, I/O). That matches the user intent of
"how long did this operation take", not "how much CPU it used".
"""

from __future__ import annotations

import asyncio
import functools
import inspect
import logging
import time
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


# Shared state — set by Client.start(), cleared by Client.stop().
# A plain dict (not a class) so reads from the hot path are O(1)
# dict lookups, the cheapest thing in CPython.
_state = {
    "writer": None,          # JsonlWriter | None
    "service": "",
    "pod": "",
    "service_version": "",
}


def _configure(writer, service, pod, service_version):
  """Called by `Client.start()` so the decorator knows where to emit.

  Idempotent. Safe to call multiple times — the last call wins, which
  matches the "one active Client per process" assumption that
  `driftdockerprofiler._started` enforces.
  """
  _state["writer"] = writer
  _state["service"] = service or ""
  _state["pod"] = pod or ""
  _state["service_version"] = service_version or ""


def _reset():
  """Called by `Client.stop()` so subsequent `@trace`d calls become no-ops."""
  _state["writer"] = None
  _state["service"] = ""
  _state["pod"] = ""
  _state["service_version"] = ""


def _emit(qualname, file_, line, duration_ns, status, end_ns):
  """Best-effort emit. Swallow ALL errors — a trace failure must not
  bubble into user code. Tracing is decorative; correctness comes
  from the user function itself."""
  writer = _state["writer"]
  if writer is None:
    return
  try:
    event = {
        "type": "function_call",
        "time": end_ns,
        "service": _state["service"],
        "pod": _state["pod"],
        "qualname": qualname,
        "file": file_,
        "line": line,
        "duration_ns": int(duration_ns),
        "status": status,
    }
    service_version = _state["service_version"]
    if service_version:
      event["service_version"] = service_version
    writer.emit(event)
  except BaseException:  # pylint: disable=broad-except
    # Swallow EVERYTHING — including KeyboardInterrupt etc. so a
    # SIGINT during emit doesn't lose its meaning at a worse place.
    pass


def trace(func: F) -> F:
  """Decorator: emit one `function_call` event per call of `func`.

  Works on both sync and async functions. Preserves `__wrapped__`
  + functools metadata so introspection (FastAPI dependency-injection
  signature reading, inspect.signature) keeps working.

  Usage::

      from driftdockerprofiler import trace

      class OrderService:
          @trace
          def create(self, order_id, customer, items):
              ...

          @trace
          async def charge(self, order_id, amount, password):
              ...

  Behavior when no Client is running: the decorated function executes
  exactly as if undecorated. `_state["writer"] is None` and the emit
  is a fast-return at the top of `_emit`.
  """
  code = getattr(func, "__code__", None)
  if code is None:
    # Built-in or C function — can't decorate sensibly. Return as-is.
    return func

  qualname = getattr(func, "__qualname__", func.__name__)
  file_ = code.co_filename
  line = code.co_firstlineno

  # `inspect.iscoroutinefunction` rather than `asyncio.iscoroutinefunction`
  # because the asyncio one is deprecated since 3.12 and removal-pending
  # in 3.16. Functionally equivalent for our purposes.
  if inspect.iscoroutinefunction(func):
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
      start_ns = time.time_ns()
      status = "ok"
      try:
        return await func(*args, **kwargs)
      except BaseException:
        status = "error"
        raise
      finally:
        end_ns = time.time_ns()
        _emit(qualname, file_, line, end_ns - start_ns, status, end_ns)
    return async_wrapper  # type: ignore[return-value]

  @functools.wraps(func)
  def sync_wrapper(*args, **kwargs):
    start_ns = time.time_ns()
    status = "ok"
    try:
      return func(*args, **kwargs)
    except BaseException:
      status = "error"
      raise
    finally:
      end_ns = time.time_ns()
      _emit(qualname, file_, line, end_ns - start_ns, status, end_ns)
  return sync_wrapper  # type: ignore[return-value]


__all__ = ["trace"]
