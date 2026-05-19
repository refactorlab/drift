# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""Unit tests for `driftdockerprofiler.backoff.Backoff`.

Ported from upstream googlecloudprofiler.backoff — the test surface is
small (one class, three observable behaviors: monotonic growth,
capped, reset). We test those directly + the optional server-hint
parsing.
"""

import pytest

from driftdockerprofiler.backoff import Backoff


def test_starts_near_minimum():
    b = Backoff()
    d = b.next_backoff()
    # Jitter is ±10 %, so first call lands in [_MIN*(1-0.1), _MIN*(1+0.1)].
    assert Backoff._MIN_BACKOFF_S * 0.9 <= d <= Backoff._MIN_BACKOFF_S * 1.1


def test_monotonic_growth_until_cap():
    """Each call (without server hint) should produce a roughly larger
    delay than the previous, up to the cap. Jitter means it's not
    strictly monotonic per call but the trend MUST be upward."""
    b = Backoff()
    samples = [b.next_backoff() for _ in range(50)]
    # After 50 doublings (1.3 multiplier) we should be at the cap.
    assert samples[-1] >= Backoff._MAX_BACKOFF_S * 0.9
    # And capped from above (within jitter).
    assert samples[-1] <= Backoff._MAX_BACKOFF_S * 1.1
    # Mean of the last 5 should be much larger than the first 5.
    assert sum(samples[-5:]) / 5 > sum(samples[:5]) / 5 * 100


def test_reset_returns_to_minimum():
    b = Backoff()
    for _ in range(20):
        b.next_backoff()
    # Now b._next is at the cap. After reset, next_backoff should
    # be near the minimum again.
    b.reset()
    d = b.next_backoff()
    assert d <= Backoff._MIN_BACKOFF_S * 1.5


# ----------------------------------------------------------------- server hints

def test_server_hint_via_attribute_overrides_exponential():
    """An exception carrying `retry_delay_s` short-circuits the
    exponential schedule."""
    b = Backoff()
    # Run a few times so b._next is large.
    for _ in range(10):
        b.next_backoff()

    class HintedError(Exception):
        retry_delay_s = 0.5

    d = b.next_backoff(HintedError())
    # Should be the hint ± jitter, NOT the exponential value.
    assert 0.45 <= d <= 0.55


def test_server_hint_via_dict_key_works():
    """Same path but for HTTP-style error objects that subscript like dicts."""
    b = Backoff()
    for _ in range(5):
        b.next_backoff()

    class DictError(Exception):
        def __getitem__(self, key):
            if key == 'retryDelay':
                return 0.25
            raise KeyError(key)

    d = b.next_backoff(DictError())
    assert 0.22 <= d <= 0.28


def test_missing_hint_falls_back_to_exponential():
    """An exception with no retry hint goes through the exponential path."""
    b = Backoff()
    d1 = b.next_backoff()
    d2 = b.next_backoff(ValueError('boom'))   # no hint
    assert d2 >= d1     # grew (monotonic; jitter is small)


def test_none_error_uses_exponential():
    b = Backoff()
    d1 = b.next_backoff(None)
    d2 = b.next_backoff(None)
    assert d2 >= d1
