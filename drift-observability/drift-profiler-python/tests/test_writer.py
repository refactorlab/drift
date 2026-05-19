# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""Unit tests for `driftdockerprofiler.writer.JsonlWriter`."""

import json
import os
import threading

import pytest

from driftdockerprofiler.writer import (
    DEFAULT_OUTPUT_PATH,
    JsonlWriter,
    _ns_to_iso,
    default_output_path,
    frames_to_dicts,
)


def test_default_path_is_in_tmp():
    assert default_output_path() == DEFAULT_OUTPUT_PATH
    # We standardize on /tmp because the agent is intended to run on
    # Linux containers. Tests on macOS hit the same path because /tmp
    # is symlinked to /private/tmp.
    assert DEFAULT_OUTPUT_PATH.startswith('/tmp/')


def test_ns_to_iso_round_trips():
    # Use a fixed, easy-to-verify timestamp: epoch + 0.001234 s.
    iso = _ns_to_iso(1_234_000)
    assert iso == '1970-01-01T00:00:00.001234Z'

    # Pure epoch.
    assert _ns_to_iso(0) == '1970-01-01T00:00:00.000000Z'

    # Real-ish time — just sanity-check formatting (not exact value,
    # which is dst/tz independent because we anchor on UTC).
    iso2 = _ns_to_iso(1_700_000_000_000_000_000)  # ~2023-11-14
    assert iso2.endswith('Z')
    assert iso2.startswith('2023-11-')


def test_emit_writes_one_line_per_event(tmp_path):
    p = str(tmp_path / 'events.jsonl')
    w = JsonlWriter(p)
    try:
        w.emit({'type': 'wall_trace', 'count': 1, 'frames': []})
        w.emit({'type': 'cpu_trace', 'count': 2, 'frames': []})
    finally:
        w.close()

    lines = open(p).read().splitlines()
    assert len(lines) == 2
    evt1 = json.loads(lines[0])
    evt2 = json.loads(lines[1])
    assert evt1['type'] == 'wall_trace'
    assert evt2['type'] == 'cpu_trace'
    # `time` was auto-filled (no `time` key passed in).
    assert evt1['time'].endswith('Z')
    assert evt2['time'].endswith('Z')


def test_emit_converts_int_ns_time_to_iso(tmp_path):
    p = str(tmp_path / 'events.jsonl')
    w = JsonlWriter(p)
    try:
        # Epoch + 0.001234 s — a value we can verify exactly.
        w.emit({'type': 'wall_trace', 'time': 1_234_000})
    finally:
        w.close()

    evt = json.loads(open(p).read().splitlines()[0])
    assert evt['time'] == '1970-01-01T00:00:00.001234Z'


def test_emit_passes_string_time_through(tmp_path):
    p = str(tmp_path / 'events.jsonl')
    w = JsonlWriter(p)
    try:
        w.emit({'type': 'wall_trace', 'time': '2026-01-01T00:00:00.000000Z'})
    finally:
        w.close()

    evt = json.loads(open(p).read().splitlines()[0])
    # Already-string `time` should be preserved verbatim.
    assert evt['time'] == '2026-01-01T00:00:00.000000Z'


def test_emit_is_thread_safe(tmp_path):
    """Many threads writing concurrently must not corrupt lines.

    We rely on the writer's internal lock to ensure each emit's
    `write()` pair runs to completion before another thread can
    interleave its bytes. With N=200 threads emitting 50 events each,
    the file must contain exactly 10_000 valid JSON lines.
    """
    p = str(tmp_path / 'events.jsonl')
    w = JsonlWriter(p)

    def hammer(tid):
        for i in range(50):
            w.emit({'tid': tid, 'i': i, 'type': 'wall_trace'})

    threads = [threading.Thread(target=hammer, args=(t,)) for t in range(200)]
    for t in threads: t.start()
    for t in threads: t.join()
    w.close()

    lines = open(p).read().splitlines()
    assert len(lines) == 10_000
    # Every line should parse — if a write interleaved we'd see broken JSON.
    parsed = [json.loads(l) for l in lines]
    # Spot check: each (tid, i) combination should appear exactly once.
    seen = {(e['tid'], e['i']) for e in parsed}
    assert len(seen) == 10_000


def test_emit_creates_parent_directory(tmp_path):
    nested = tmp_path / 'a' / 'b' / 'c' / 'events.jsonl'
    w = JsonlWriter(str(nested))
    try:
        w.emit({'type': 'wall_trace'})
    finally:
        w.close()
    assert nested.exists()


def test_path_accessor(tmp_path):
    p = str(tmp_path / 'events.jsonl')
    w = JsonlWriter(p)
    try:
        assert w.path == p
        assert w.emitted == 0
        w.emit({'type': 'wall_trace'})
        assert w.emitted == 1
    finally:
        w.close()


def test_frames_to_dicts():
    trace = (('leaf', '/a/x.py', 12), ('caller', '/a/y.py', 99))
    assert frames_to_dicts(trace) == [
        {'name': 'leaf', 'file': '/a/x.py', 'line': 12},
        {'name': 'caller', 'file': '/a/y.py', 'line': 99},
    ]
