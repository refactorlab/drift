# Copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License").
"""Unit tests for `driftdockerprofiler.metrics`.

These probes are tiny — they wrap one syscall each — but we still test
them so a future "let's use psutil" PR can't silently change the
units (bytes vs. kilobytes) or default-on-failure behavior.
"""

import os
import sys

import pytest

from driftdockerprofiler import metrics


def test_cpu_load_is_non_negative_float():
    v = metrics.cpu_load()
    assert isinstance(v, float)
    # `os.getloadavg` can return 0.0 on a freshly booted container but
    # cannot legitimately return a negative number.
    assert v >= 0.0


def test_memory_rss_bytes_is_positive_on_posix():
    if not (sys.platform.startswith('linux') or sys.platform.startswith('darwin')):
        pytest.skip('non-POSIX — RSS probe returns 0 by design')
    rss = metrics.memory_rss_bytes()
    assert isinstance(rss, int)
    # A live Python process has *some* RSS. Anything > 1 MB is a sane
    # lower bound — even a stripped interpreter sits well above that.
    assert rss > 1_000_000, f'suspiciously small RSS: {rss}'


def test_snapshot_returns_triple():
    """snapshot() returns (cpu_load, rss, peak_rss). Peak is always
    monotonic ≥ current RSS by the definition of ru_maxrss."""
    cpu, rss, peak = metrics.snapshot()
    assert isinstance(cpu, float)
    assert isinstance(rss, int)
    assert isinstance(peak, int)
    # Peak RSS is monotonic non-decreasing — must be at least current.
    if rss > 0 and peak > 0:
        assert peak >= rss


def test_memory_peak_bytes_is_positive_on_posix():
    if not (sys.platform.startswith('linux') or sys.platform.startswith('darwin')):
        pytest.skip('non-POSIX — peak RSS probe returns 0 by design')
    peak = metrics.memory_peak_bytes()
    assert isinstance(peak, int)
    assert peak > 1_000_000   # any live Python process is > 1 MB


@pytest.mark.skipif(not sys.platform.startswith('linux'),
                    reason='/proc/self/statm is Linux-only')
def test_linux_uses_proc_statm():
    """On Linux, RSS comes from /proc/self/statm field [1] * page_size.
    Verify the math by comparing against the live file contents."""
    with open('/proc/self/statm') as f:
        rss_pages = int(f.read().split()[1])
    expected_bytes = rss_pages * os.sysconf('SC_PAGE_SIZE')
    actual_bytes = metrics.memory_rss_bytes()
    # The probe and our read are not atomic — allow ±1 MB of drift.
    assert abs(actual_bytes - expected_bytes) < 1_000_000
