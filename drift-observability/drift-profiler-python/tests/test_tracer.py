# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""Unit tests for `driftdockerprofiler.tracer.trace`.

The decorator must:
  - emit a `function_call` event per call when a Client is running,
  - be a no-op when no Client is running,
  - capture `status='error'` when the decorated function raises,
  - propagate the original exception,
  - work for both sync and async functions,
  - preserve `__wrapped__`, `__name__`, `__qualname__` (functools.wraps),
  - never let an emit error bubble into user code.
"""

import asyncio
import json

import pytest

from driftdockerprofiler import trace
from driftdockerprofiler import tracer
from driftdockerprofiler.writer import JsonlWriter


@pytest.fixture(autouse=True)
def _clean_tracer_state():
    """Each test starts with the tracer fully reset."""
    tracer._reset()
    yield
    tracer._reset()


def _events_in(path):
    return [json.loads(l) for l in open(path).read().splitlines() if l]


# ----------------------------------------------------------------- noop

def test_trace_is_noop_when_no_client_running(tmp_path):
    """Decorator must not crash when emit has nowhere to go."""
    @trace
    def f(x):
        return x * 2

    assert f(21) == 42   # behavior preserved exactly


# ----------------------------------------------------------------- sync

def test_trace_emits_one_event_per_sync_call(tmp_path):
    out = tmp_path / "events.jsonl"
    w = JsonlWriter(str(out))
    tracer._configure(writer=w, service="t", pod="p", service_version="")

    @trace
    def add(a, b):
        return a + b

    for _ in range(3):
        assert add(1, 2) == 3

    tracer._reset()
    w.close()

    events = _events_in(out)
    assert len(events) == 3
    for ev in events:
        assert ev["type"] == "function_call"
        assert ev["qualname"].endswith("add")
        assert ev["status"] == "ok"
        assert ev["duration_ns"] >= 0
        assert ev["service"] == "t"
        assert ev["pod"] == "p"


# ----------------------------------------------------------------- error path

def test_trace_records_error_status_and_propagates(tmp_path):
    out = tmp_path / "events.jsonl"
    w = JsonlWriter(str(out))
    tracer._configure(writer=w, service="t", pod="p", service_version="")

    @trace
    def boom():
        raise ValueError("nope")

    with pytest.raises(ValueError, match="nope"):
        boom()
    tracer._reset()
    w.close()

    events = _events_in(out)
    assert len(events) == 1
    assert events[0]["status"] == "error"
    assert events[0]["qualname"].endswith("boom")


# ----------------------------------------------------------------- async

def test_trace_works_on_async_function(tmp_path):
    out = tmp_path / "events.jsonl"
    w = JsonlWriter(str(out))
    tracer._configure(writer=w, service="t", pod="p", service_version="")

    @trace
    async def slow_add(a, b):
        await asyncio.sleep(0.001)
        return a + b

    result = asyncio.run(slow_add(2, 3))
    assert result == 5

    tracer._reset()
    w.close()

    events = _events_in(out)
    assert len(events) == 1
    ev = events[0]
    assert ev["status"] == "ok"
    assert ev["qualname"].endswith("slow_add")
    # Sleep is 1ms; duration must be at least that.
    assert ev["duration_ns"] >= 900_000


# ----------------------------------------------------------------- preserves metadata

def test_trace_preserves_functools_wraps_metadata():
    @trace
    def named_function(x):
        """A docstring."""
        return x

    assert named_function.__name__ == "named_function"
    assert named_function.__doc__ == "A docstring."
    # __wrapped__ lets inspect.signature follow through to the original.
    assert hasattr(named_function, "__wrapped__")


def test_trace_returns_func_unchanged_for_builtins():
    """Builtins have no `__code__`; decorator returns them untouched."""
    decorated = trace(len)
    assert decorated is len


# ----------------------------------------------------------------- service_version

def test_service_version_is_emitted_when_set(tmp_path):
    out = tmp_path / "events.jsonl"
    w = JsonlWriter(str(out))
    tracer._configure(writer=w, service="s", pod="p", service_version="v9")

    @trace
    def f(): return 1
    f()
    tracer._reset()
    w.close()

    ev = _events_in(out)[0]
    assert ev["service_version"] == "v9"


def test_service_version_omitted_when_empty(tmp_path):
    out = tmp_path / "events.jsonl"
    w = JsonlWriter(str(out))
    tracer._configure(writer=w, service="s", pod="p", service_version="")

    @trace
    def f(): return 1
    f()
    tracer._reset()
    w.close()

    ev = _events_in(out)[0]
    assert "service_version" not in ev


# ----------------------------------------------------------------- exclude_paths integration

def test_writer_failure_does_not_break_user_code(tmp_path):
    """If the writer raises on emit, user code keeps working."""
    class BrokenWriter:
        def emit(self, _event):
            raise RuntimeError("disk gone")

    tracer._configure(writer=BrokenWriter(), service="s", pod="p", service_version="")

    @trace
    def f(x):
        return x + 1

    # Must NOT raise even though emit blows up internally.
    assert f(10) == 11
