"""CPU time profiler — Python wrapper around the native SIGPROF sampler.

Forked from Google Cloud Profiler. The original built a gzipped pprof
bundle here for upload. We now return the raw `{trace: count}` dict
from the native extension straight through and let the caller
serialize. The C++ side is unchanged.
"""

import logging

from driftdockerprofiler import _profiler

logger = logging.getLogger(__name__)


class CPUProfiler:
  """CPU time profiler.

  Collects CPU time usage by installing a SIGPROF handler in the
  native `driftdockerprofiler._profiler` extension. SIGPROF fires on
  CPU time (not wall time), so an idle process produces no samples
  even if it runs for a long time. Unlike the wall profiler, SIGPROF
  can sample every runnable thread.
  """

  PROFILE_TYPE = 'cpu'

  def __init__(self, period_ms=10):
    """Constructs the CPU time profiler.

    Args:
      period_ms: An optional integer specifying the sampling interval in
        milliseconds. Defaults to 10.
    """
    self._period_ms = period_ms
    self._period_ns = period_ms * 1_000_000

  @property
  def period_ns(self):
    return self._period_ns

  def profile(self, duration_ns):
    """Profiles the CPU time usage for the given duration.

    Args:
      duration_ns: An integer specifying the duration to profile in nanoseconds.

    Returns:
      A `dict[tuple[(name, file, line), ...], int]` mapping each unique
      call stack seen during the window to its sample count. Same
      shape as `WallProfiler.profile()`.
    """
    return _profiler.profile_cpu(duration_ns, self._period_ms)
