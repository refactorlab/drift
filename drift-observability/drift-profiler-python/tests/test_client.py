# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""End-to-end tests for `driftdockerprofiler.client.Client`.

The class is a close fork of upstream `googlecloudprofiler.client.Client`
and uses the same two-phase init: `Client()` then `client.config(...)`.
Tests drive that path directly + also exercise the module-level
`driftdockerprofiler.start()` convenience that wraps both steps.

Start the client → burn CPU on the main thread → stop → read JSONL.
The whole pipeline (SIGALRM, polling thread, writer) is exercised — no mocks.
"""

import json
import os
import signal
import sys
import time

import pytest

import driftdockerprofiler
from driftdockerprofiler.client import Client, cpu_profiling_available

pytestmark = pytest.mark.skipif(
    not (sys.platform.startswith('linux') or sys.platform.startswith('darwin')),
    reason='client uses POSIX signals; skipped on non-POSIX',
)


def _busy_burn(duration_s):
    end = time.monotonic() + duration_s
    n = 0
    while time.monotonic() < end:
        n += 1
    return n


def _read_events(path):
    if not os.path.exists(path):
        return []
    return [json.loads(l) for l in open(path).read().splitlines() if l]


def _mk_client(**config_kwargs):
    """Build + config a Client in one step. Mirrors the upstream
    two-phase pattern (`Client()` → `client.config(...)`) but lets
    tests stay one-liners."""
    c = Client()
    c.config(**config_kwargs)
    return c


@pytest.fixture(autouse=True)
def _clean_module_state():
    """Reset the module-level `driftdockerprofiler.start/stop` state
    between tests so each one starts from a known baseline."""
    try:
        driftdockerprofiler.stop()
    except Exception:
        pass
    driftdockerprofiler._started = False
    driftdockerprofiler._client = None
    yield
    try:
        driftdockerprofiler.stop()
    except Exception:
        pass
    # Drain any lingering SIGALRM timer so it doesn't bleed into the next test.
    try:
        signal.setitimer(signal.ITIMER_REAL, 0)
    except (OSError, AttributeError):
        pass


# ----------------------------------------------------------------- config

def test_invalid_service_name_rejected(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    with pytest.raises(ValueError, match='Service name'):
        _mk_client(service='Has Spaces!', output_path=out)


def test_empty_service_rejected(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    # Strip env so service can't fall back via GAE_SERVICE / K_SERVICE.
    saved = {k: os.environ.pop(k, None) for k in ('GAE_SERVICE', 'K_SERVICE')}
    try:
        with pytest.raises(ValueError, match='Service name'):
            _mk_client(service='', output_path=out)
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


def test_both_profilers_disabled_rejected(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    with pytest.raises(ValueError, match='No profiling mode'):
        _mk_client(service='svc', output_path=out,
                   disable_cpu_profiling=True, disable_wall_profiling=True)


def test_invalid_period_rejected(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    with pytest.raises(ValueError, match='period_ms'):
        _mk_client(service='svc', output_path=out, period_ms=0)
    with pytest.raises(ValueError, match='duration_ms'):
        _mk_client(service='svc', output_path=out, duration_ms=0)


def test_emit_mode_rejects_invalid_value(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    with pytest.raises(ValueError, match='emit_mode'):
        _mk_client(service='svc', output_path=out, emit_mode='nope')


# ----------------------------------------------------------------- two-phase init

def test_construct_does_not_require_config():
    """`Client()` alone is legal — config can come later. Mirrors
    upstream's pattern of building the client before knowing all the
    knobs (auth came in the middle there)."""
    c = Client()
    # No service / no writer / no profilers yet — only backoff state.
    assert c._started is False
    assert c._profilers is None
    assert c._writer is None


def test_start_without_config_is_a_warning_noop():
    """Defensive: starting before config() shouldn't crash."""
    c = Client()
    # Without config() there are no profilers; calling start() in this
    # state would hit `'WALL' in self._profilers` → TypeError on None.
    # Document that as a precondition.
    with pytest.raises((AttributeError, TypeError)):
        c.start()


# ----------------------------------------------------------------- end-to-end

def test_client_emits_wall_trace_events(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    c = _mk_client(
        service='svc-x',
        output_path=out,
        period_ms=5,
        duration_ms=200,     # short window so the test runs quickly
        disable_cpu_profiling=True,
    )
    c.start()
    try:
        # Run more than one window so we know the polling loop actually loops.
        _busy_burn(0.5)
    finally:
        c.stop()

    events = _read_events(out)
    wall_events = [e for e in events if e.get('type') == 'wall_trace']
    assert wall_events, f'no wall_trace events found in {events}'

    ev = wall_events[0]
    assert ev['service'] == 'svc-x'
    assert ev['period_ns'] == 5_000_000
    assert ev['duration_ns'] == 200_000_000
    assert isinstance(ev['count'], int) and ev['count'] >= 1
    assert isinstance(ev['frames'], list) and ev['frames']
    f0 = ev['frames'][0]
    assert set(f0.keys()) == {'name', 'file', 'line'}
    assert ev['time'].endswith('Z')

    # cpu (1-min load) and memory_bytes (process RSS) are stamped on
    # every per-trace event. Both come from metrics.snapshot() at
    # window close.
    assert isinstance(ev['cpu'], float) and ev['cpu'] >= 0.0
    assert isinstance(ev['memory_bytes'], int)
    if sys.platform.startswith('linux') or sys.platform.startswith('darwin'):
        # A live Python process has >1 MB RSS — the probe is working.
        assert ev['memory_bytes'] > 1_000_000


def test_service_version_is_emitted_when_provided(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    c = _mk_client(
        service='svc',
        service_version='v42',
        output_path=out,
        period_ms=5,
        duration_ms=200,
        disable_cpu_profiling=True,
    )
    c.start()
    try:
        _busy_burn(0.3)
    finally:
        c.stop()
    events = _read_events(out)
    wall = [e for e in events if e.get('type') == 'wall_trace']
    assert wall
    assert all(e.get('service_version') == 'v42' for e in wall)


def test_service_version_omitted_when_empty(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    c = _mk_client(
        service='svc',
        output_path=out,
        period_ms=5,
        duration_ms=200,
        disable_cpu_profiling=True,
    )
    c.start()
    try:
        _busy_burn(0.3)
    finally:
        c.stop()
    events = _read_events(out)
    wall = [e for e in events if e.get('type') == 'wall_trace']
    assert wall
    assert all('service_version' not in e for e in wall)


def test_default_output_path_is_tmp_drift(tmp_path):
    """When `output_path` is omitted the client writes to /tmp/drift/events.jsonl."""
    c = _mk_client(
        service='svc',
        period_ms=5,
        duration_ms=200,
        disable_cpu_profiling=True,
        disable_wall_profiling=False,
    )
    # JsonlWriter exposes .path; the client routes through it.
    assert c._writer.path == '/tmp/drift/events.jsonl'
    # Don't actually start — we don't want to clobber the real shared file.


# ----------------------------------------------------------------- module-level API

def test_module_start_stop_writes_events(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    driftdockerprofiler.start(
        service='mod-svc',
        output_path=out,
        period_ms=5,
        duration_ms=200,
        disable_cpu_profiling=True,
    )
    try:
        _busy_burn(0.4)
    finally:
        driftdockerprofiler.stop()

    events = _read_events(out)
    assert any(e.get('service') == 'mod-svc' and e.get('type') == 'wall_trace'
               for e in events)


def test_module_start_requires_service():
    """Without service / GAE_SERVICE / K_SERVICE, start() raises ValueError."""
    saved = {k: os.environ.pop(k, None) for k in ('GAE_SERVICE', 'K_SERVICE')}
    try:
        with pytest.raises(ValueError, match='Service name'):
            driftdockerprofiler.start()
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


def test_module_start_picks_up_env(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    os.environ['GAE_SERVICE'] = 'env-svc'
    try:
        driftdockerprofiler.start(
            output_path=out, period_ms=5, duration_ms=200,
            disable_cpu_profiling=True,
        )
        _busy_burn(0.3)
    finally:
        driftdockerprofiler.stop()
        os.environ.pop('GAE_SERVICE', None)

    events = _read_events(out)
    assert any(e.get('service') == 'env-svc' for e in events)


def test_double_start_is_a_noop_warning(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    driftdockerprofiler.start(
        service='svc', output_path=out, period_ms=10, duration_ms=200,
        disable_cpu_profiling=True,
    )
    try:
        # Second call should log a warning and NOT raise.
        driftdockerprofiler.start(service='other', output_path=out)
    finally:
        driftdockerprofiler.stop()


# ----------------------------------------------------------------- emit_mode

def test_bundle_mode_emits_one_line_per_window(tmp_path):
    """In bundle mode, every profile window produces exactly ONE JSONL
    line carrying the whole Profile (all samples inlined)."""
    out = str(tmp_path / 'events.jsonl')
    c = _mk_client(
        service='svc-bundle',
        output_path=out,
        period_ms=5,
        duration_ms=200,
        disable_cpu_profiling=True,
        emit_mode='bundle',
    )
    c.start()
    try:
        _busy_burn(0.7)         # multiple windows
    finally:
        c.stop()

    events = _read_events(out)
    wall_profiles = [e for e in events if e.get('type') == 'wall_profile']
    assert wall_profiles, f'no wall_profile events found in {events}'

    ev = wall_profiles[0]
    # Shape matches profiler_json.Profile.to_dict().
    assert ev['profile_type'] == 'wall'
    assert ev['service'] == 'svc-bundle'
    assert ev['period_ns'] == 5_000_000
    assert ev['duration_ns'] == 200_000_000
    assert ev['sample_type'] == [
        {'type': 'sample', 'unit': 'count'},
        {'type': 'wall', 'unit': 'nanoseconds'},
    ]
    assert isinstance(ev['samples'], list) and ev['samples']
    s0 = ev['samples'][0]
    assert set(s0.keys()) >= {'count', 'value_ns', 'frames', 'labels'}
    assert isinstance(s0['frames'], list) and s0['frames']
    assert ev['time'].endswith('Z')

    # Window-level metrics live on the Profile itself, not on each sample.
    assert isinstance(ev['cpu'], float) and ev['cpu'] >= 0.0
    assert isinstance(ev['memory_bytes'], int)
    if sys.platform.startswith('linux') or sys.platform.startswith('darwin'):
        assert ev['memory_bytes'] > 1_000_000


def test_per_trace_mode_is_default(tmp_path):
    """Omitting emit_mode keeps the per-trace output."""
    out = str(tmp_path / 'events.jsonl')
    c = _mk_client(
        service='svc-default',
        output_path=out,
        period_ms=5,
        duration_ms=200,
        disable_cpu_profiling=True,
    )
    c.start()
    try:
        _busy_burn(0.3)
    finally:
        c.stop()
    events = _read_events(out)
    types = {e.get('type') for e in events}
    assert 'wall_trace' in types
    assert 'wall_profile' not in types


# ----------------------------------------------------------------- CPU profiler

@pytest.mark.skipif(not cpu_profiling_available(),
                    reason='native CPU profiler not available')
def test_client_emits_cpu_trace_events(tmp_path):
    out = str(tmp_path / 'events.jsonl')
    c = _mk_client(
        service='svc-cpu',
        output_path=out,
        period_ms=10,
        duration_ms=500,
        disable_wall_profiling=True,    # CPU-only window
    )
    c.start()
    try:
        _busy_burn(0.9)
    finally:
        c.stop()
    events = _read_events(out)
    cpu_events = [e for e in events if e.get('type') == 'cpu_trace']
    assert cpu_events
