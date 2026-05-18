"""Smoke tests for drift: wrap, emit start+end with shared call UUID,
redact, exception path, caller location, cycle/depth safety, include flags."""
from __future__ import annotations

import json
import sys
import time
import types
from pathlib import Path

import pytest


def _install_with(yaml_text: str, tmp_path: Path):
    import drift
    cfg = tmp_path / "drift.yaml"
    cfg.write_text(yaml_text)
    return drift.install(str(cfg))


def _read_events(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def test_emits_start_and_end_per_call(tmp_path: Path) -> None:
    target = types.ModuleType("svc_a")

    class API:
        def hello(self, name: str, password: str) -> str:
            return f"hi {name}"

    target.API = API
    sys.modules["svc_a"] = target

    log = tmp_path / "events.log"
    _install_with(f"""
service: test
log_path: "{log}"
methods:
  - svc_a.API.hello
""", tmp_path)

    try:
        assert API().hello("world", "supersecret") == "hi world"
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    events = _read_events(log)
    assert len(events) == 2

    start, end = events
    # No `phase` field — distinguish by presence of `params` vs `duration_ms`.
    assert "phase" not in start
    assert "phase" not in end

    # --- start ---------------------------------------------------------------
    assert start["qualname"] == "svc_a.API.hello"
    assert start["params"] == {"name": "world", "password": "***"}
    assert isinstance(start["call"], str) and len(start["call"]) == 32   # UUID4 hex
    assert start["file"] == __file__
    assert isinstance(start["line"], int) and start["line"] > 0
    assert start["service"] == "test"
    assert "pod" in start

    # --- end -----------------------------------------------------------------
    assert end["call"] == start["call"]
    assert end["status"] == "ok"
    assert end["duration_ms"] >= 0
    assert end["qualname"] == "svc_a.API.hello"
    # Caller location reused from start — single stack walk per call.
    assert end["file"] == start["file"]
    assert end["line"] == start["line"]
    # Params are INPUT-only — never on end.
    assert "params" not in end


def test_exception_records_error(tmp_path: Path) -> None:
    target = types.ModuleType("svc_b")

    class Boom:
        def go(self) -> None:
            raise RuntimeError("nope")

    target.Boom = Boom
    sys.modules["svc_b"] = target

    log = tmp_path / "events.log"
    _install_with(f"""
service: test
log_path: "{log}"
methods:
  - svc_b.Boom.go
""", tmp_path)

    try:
        with pytest.raises(RuntimeError):
            Boom().go()
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    events = _read_events(log)
    assert len(events) == 2
    # start has params, end has duration_ms (no `phase` field).
    assert "params" in events[0] and "params" not in events[1]
    assert "duration_ms" in events[1] and "duration_ms" not in events[0]
    assert events[1]["call"] == events[0]["call"]
    assert events[1]["status"] == "error"
    assert events[1]["error"] == "RuntimeError: nope"


def test_explicit_param_filter(tmp_path: Path) -> None:
    target = types.ModuleType("svc_c")

    class Svc:
        def op(self, keep: int, drop: str) -> int:
            return keep

    target.Svc = Svc
    sys.modules["svc_c"] = target

    log = tmp_path / "events.log"
    _install_with(f"""
service: test
log_path: "{log}"
methods:
  - target: svc_c.Svc.op
    params: [keep]
""", tmp_path)

    try:
        Svc().op(42, "junk")
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    start = _read_events(log)[0]
    assert start["params"] == {"keep": 42}


def test_include_flags_drop_fields(tmp_path: Path) -> None:
    """`include: {pod: false, service: false, caller: false}` must omit
    those fields from every event."""
    target = types.ModuleType("svc_inc")

    class S:
        def f(self, x: int) -> int:
            return x

    target.S = S
    sys.modules["svc_inc"] = target

    log = tmp_path / "events.log"
    _install_with(f"""
service: test
log_path: "{log}"
include:
  pod: false
  service: false
  caller: false
methods:
  - svc_inc.S.f
""", tmp_path)

    try:
        S().f(1)
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    for ev in _read_events(log):
        assert "service" not in ev
        assert "pod" not in ev
        assert "file" not in ev   # file/line come from caller capture; off here
        assert "line" not in ev
    # Core identity fields must always be present.
    start = _read_events(log)[0]
    assert start["qualname"] == "svc_inc.S.f"
    assert "call" in start


def test_cycle_in_param_does_not_crash(tmp_path: Path) -> None:
    """A self-referencing dict must produce '<cycle: dict>', not RecursionError."""
    target = types.ModuleType("svc_cycle")

    class API:
        def go(self, payload: dict) -> str:
            return "ok"

    target.API = API
    sys.modules["svc_cycle"] = target

    log = tmp_path / "events.log"
    _install_with(f'service: t\nlog_path: "{log}"\nmethods: [svc_cycle.API.go]\n', tmp_path)

    cyclic: dict = {"a": 1}
    cyclic["self"] = cyclic

    try:
        assert API().go(cyclic) == "ok"
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    start = _read_events(log)[0]
    assert start["params"]["payload"]["a"] == 1
    assert "<cycle: dict>" in start["params"]["payload"]["self"]


def test_deeply_nested_param_is_truncated(tmp_path: Path) -> None:
    """Nesting beyond _MAX_DEPTH must summarize, not recurse forever."""
    target = types.ModuleType("svc_deep")

    class API:
        def go(self, payload: dict) -> str:
            return "ok"

    target.API = API
    sys.modules["svc_deep"] = target

    log = tmp_path / "events.log"
    _install_with(f'service: t\nlog_path: "{log}"\nmethods: [svc_deep.API.go]\n', tmp_path)

    deep: dict = {"v": "leaf"}
    for _ in range(12):
        deep = {"n": deep}

    try:
        API().go(deep)
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    start = _read_events(log)[0]
    cur = start["params"]["payload"]
    found_marker = False
    for _ in range(20):
        if isinstance(cur, str) and "depth-exceeded" in cur:
            found_marker = True
            break
        if isinstance(cur, dict) and "n" in cur:
            cur = cur["n"]
        else:
            break
    assert found_marker, f"depth marker missing in {start['params']['payload']!r}"


def test_variadic_signature_uses_bind_fallback(tmp_path: Path) -> None:
    """Methods with *args/**kwargs go through the bind_partial fallback path."""
    target = types.ModuleType("svc_d")

    class Svc:
        def flex(self, a, *args, **kwargs):
            return (a, args, kwargs)

    target.Svc = Svc
    sys.modules["svc_d"] = target

    log = tmp_path / "events.log"
    _install_with(f"""
service: test
log_path: "{log}"
methods:
  - svc_d.Svc.flex
""", tmp_path)

    try:
        Svc().flex(1, 2, 3, x=10, password="hush")
        time.sleep(0.2)
    finally:
        import drift; drift.uninstall()

    start = _read_events(log)[0]
    assert start["params"]["a"] == 1
    assert start["params"]["args"] == [2, 3]
    assert start["params"]["kwargs"]["password"] == "***"
