# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""Unit tests for `driftdockerprofiler.profiler_json`.

The JSON profile schema replaces `profile_pb2.py` (deleted with the
protobuf dependency). These tests pin the schema's shape so a future
edit can't silently change the on-disk JSON contract.
"""

import json

import pytest

from driftdockerprofiler.profiler_json import (
    Builder,
    Frame,
    Profile,
    Sample,
    ValueType,
    bundle_event_type,
    per_trace_event_type,
)


# ----------------------------------------------------------------- dataclasses

def test_value_type_serializes():
    vt = ValueType(type='wall', unit='nanoseconds')
    assert vt.type == 'wall' and vt.unit == 'nanoseconds'


def test_frame_serializes():
    f = Frame(name='leaf', file='/a/x.py', line=12)
    assert f.name == 'leaf' and f.file == '/a/x.py' and f.line == 12


def test_sample_has_default_labels_dict():
    s = Sample(count=1, value_ns=10)
    # Mutable default would be a dataclass smell — confirm it's fresh
    # per instance.
    s1 = Sample(count=1, value_ns=10)
    s.labels['k'] = 'v'
    assert s1.labels == {}


def test_profile_to_json_round_trips():
    p = Profile(
        profile_type='wall',
        period_ns=10_000_000,
        duration_ns=200_000_000,
        time_ns=1_234_000,
        sample_type=[
            ValueType(type='sample', unit='count'),
            ValueType(type='wall', unit='nanoseconds'),
        ],
        samples=[
            Sample(count=5, value_ns=50_000_000,
                   frames=[Frame(name='f', file='/x.py', line=1)]),
        ],
        service='svc',
        pod='pod',
        service_version='v1',
        cpu=0.42,
        memory_bytes=42_000_000,
    )
    # Profile.to_dict() flattens to a plain dict; verifies round-trip
    # through json.dumps too (the writer does the same thing).
    data = json.loads(json.dumps(p.to_dict()))
    assert data['profile_type'] == 'wall'
    assert data['period_ns'] == 10_000_000
    assert data['duration_ns'] == 200_000_000
    assert data['time_ns'] == 1_234_000
    assert data['service'] == 'svc'
    assert data['pod'] == 'pod'
    assert data['service_version'] == 'v1'
    assert data['cpu'] == 0.42
    assert data['memory_bytes'] == 42_000_000
    assert data['sample_type'] == [
        {'type': 'sample', 'unit': 'count'},
        {'type': 'wall', 'unit': 'nanoseconds'},
    ]
    assert data['samples'] == [{
        'count': 5,
        'value_ns': 50_000_000,
        'frames': [{'name': 'f', 'file': '/x.py', 'line': 1}],
        'labels': {},
    }]


# ----------------------------------------------------------------- Builder

def test_builder_populates_from_traces():
    traces = {
        (('leaf', '/a.py', 12), ('caller', '/b.py', 99)): 5,
        (('only', '/c.py', 1),): 3,
    }
    b = Builder()
    b.populate_profile(
        traces,
        profile_type='wall',
        period_unit='nanoseconds',
        period=10_000_000,
        duration_ns=200_000_000,
        time_ns=1_234_000,
        service='svc-x',
        pod='pod-y',
        service_version='v2',
        cpu=1.5,
        memory_bytes=99_000_000,
    )
    p = b.to_profile()

    assert p.profile_type == 'wall'
    assert p.period_ns == 10_000_000
    assert p.duration_ns == 200_000_000
    assert p.time_ns == 1_234_000
    assert p.service == 'svc-x'
    assert p.pod == 'pod-y'
    assert p.service_version == 'v2'
    assert p.cpu == 1.5
    assert p.memory_bytes == 99_000_000

    # sample_type[0] is always (sample, count); sample_type[1] reflects the
    # profile being built.
    assert p.sample_type[0] == ValueType('sample', 'count')
    assert p.sample_type[1] == ValueType('wall', 'nanoseconds')

    # One Sample per unique trace.
    assert len(p.samples) == 2
    # value_ns is count * period.
    for s in p.samples:
        assert s.value_ns == s.count * 10_000_000


def test_builder_to_dict_round_trips_through_json():
    """to_dict() is the production serialization path — Agent emits via
    writer.JsonlWriter, which calls json.dumps on the dict. Verifies
    that round-trip works on a non-empty bundle."""
    traces = {(('f', '/x.py', 1),): 1}
    b = Builder()
    b.populate_profile(traces, 'cpu', 'nanoseconds', 10_000_000, 100_000_000)
    data = json.loads(json.dumps(b.to_dict()))
    assert data['profile_type'] == 'cpu'
    assert len(data['samples']) == 1


def test_builder_to_profile_before_populate_raises():
    b = Builder()
    with pytest.raises(RuntimeError, match='populate_profile'):
        b.to_profile()
    with pytest.raises(RuntimeError, match='populate_profile'):
        b.to_dict()


def test_builder_time_ns_defaults_to_now():
    """If the caller doesn't pass time_ns, the Builder fills it from
    time.time_ns(). We only verify the field is non-zero — the value
    is wall-clock so we can't assert an exact number."""
    b = Builder()
    b.populate_profile({}, 'wall', 'nanoseconds', 1, 1)
    assert b.to_profile().time_ns > 0


def test_builder_handles_empty_traces():
    b = Builder()
    b.populate_profile({}, 'wall', 'nanoseconds', 10_000_000, 100_000_000,
                       time_ns=0)
    p = b.to_profile()
    # No samples, but the rest of the bundle is well-formed and
    # serializable through the same path Agent uses in production.
    assert p.samples == []
    data = json.loads(json.dumps(b.to_dict()))
    assert data['samples'] == []


# ----------------------------------------------------------------- discriminators

def test_event_type_helpers():
    assert per_trace_event_type('wall') == 'wall_trace'
    assert per_trace_event_type('cpu') == 'cpu_trace'
    assert bundle_event_type('wall') == 'wall_profile'
    assert bundle_event_type('cpu') == 'cpu_profile'
