# Copyright 2018 Google LLC
# Modifications copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
"""Writes profiles to a local JSONL file (fork of googlecloudprofiler.client).

This is a SURGICAL fork of upstream `googlecloudprofiler.client.Client`.
All GCP transport (google.auth, googleapiclient, httplib2, requests,
google.protobuf, GCE metadata probes) was deleted. The two methods
that actually crossed the network had their bodies swapped for local
equivalents:

  - `_create_profile()` — upstream long-polled the GCP CreateProfile
    RPC, blocking until the server said "now". We have no server, so
    we synthesize the spec locally — round-robin profile types every
    `duration_ms` ms. The RETURN SHAPE is preserved verbatim so
    `_collect_and_upload_profile()` is otherwise unchanged.

  - `_collect_and_upload_profile()` — upstream base64-encoded the
    pprof bytes and PATCH'd them to GCP. We append JSONL lines to a
    local file via `JsonlWriter`. The surrounding try/except
    BaseException + the call chain are kept verbatim.

Preserved verbatim from upstream:

  - Class name (`Client`) and file name (`client.py`).
  - `_poll_profiler_service` polling loop (minus the outer
    `_build_service` waiter — there's nothing to build).
  - `try/except BaseException` tolerance in `_collect_and_upload_profile`
    — this is what keeps the polling daemon alive through transient
    failures, and it's still doing exactly that work.
  - `backoff.Backoff` exponential retry on `_create_profile` errors.
  - `_config_cpu_profiling` / `_config_wall_profiling` helpers.
  - Service-name regex + env fallbacks (GAE_SERVICE/K_SERVICE,
    GAE_VERSION/K_REVISION).
  - Profile-type literals `'WALL'`/`'CPU'` (uppercase). Lowercase
    only happens at the JSONL serialization boundary, to match the
    `wall_trace`/`cpu_trace` event-type discriminators in the schema.
  - SIGALRM main-thread registration via `register_handler()`.
  - Daemon thread pattern.

Improvements over upstream:

  - Explicit `stop()` method + `stop_event` (upstream had no shutdown
    path — its daemon thread leaked the JsonlWriter buffer on exit).
  - `atexit.register(self._stop_at_exit)` so a clean process exit
    flushes the writer.
  - Pre-emptive main-thread check before `signal.signal` — clearer
    error than upstream's implicit ValueError.
  - Per-event `cpu` (loadavg) + `memory_bytes` (RSS) labels.
  - Two output modes (`per_trace` / `bundle`) via `profiler_json`.

This module has ZERO external runtime dependencies (the upstream
client.py pulled in ~30 transitive packages).
"""

import atexit
import logging
import os
import re
import socket
import sys
import threading
import time
import traceback

from driftdockerprofiler import backoff
from driftdockerprofiler import metrics
from driftdockerprofiler import profiler_json
from driftdockerprofiler import pythonprofiler
from driftdockerprofiler import tracer
from driftdockerprofiler.writer import JsonlWriter, frames_to_dicts

# pylint: disable=g-import-not-at-top
if sys.platform.startswith('linux'):
  try:
    from driftdockerprofiler import cpu_profiler
  except ImportError:    # native _profiler ext not built into this install
    cpu_profiler = None
else:
  # CPU profiling is only supported on Linux (SIGPROF semantics on
  # macOS are too limited).
  cpu_profiler = None

# This module sometimes catches the general BaseException — preserved
# verbatim from upstream. Justification (same as upstream's):
#   - The polling loop runs in a daemon thread; Python signals are
#     handled by the main thread, so we are not blocking user
#     interruptions such as Ctrl+C.
#   - We can't predict every exception the underlying profilers
#     (especially the C++ extension) may throw, and a single transient
#     failure must not kill the agent.

_NANOS_PER_SEC = 1000 * 1000 * 1000

# Same service-name regex upstream uses.
_SERVICE_RE = re.compile(r'^[a-z0-9]([-a-z0-9_.]{0,253}[a-z0-9])?$')

# Output discriminator. Upstream had no equivalent — it always produced
# one pprof-binary per profile window.
_EMIT_MODES = ('per_trace', 'bundle')

# Exclude paths come in two layers, both substring-matched against each
# leaf frame's `file`:
#
#   1. BUILTIN_EXCLUDE_PATHS — minimal "always filter this" defaults.
#      Only covers pure noise: the profiler observing itself, plus
#      frozen importlib bootstrap. Override with
#      `config(builtin_exclude_paths=...)` (pass `()` to fully
#      disable).
#
#   2. `exclude_paths` (user-supplied) — ADDITIVE extras stacked on
#      top of the builtins. The common case is "use the defaults plus
#      my own patterns", e.g. `exclude_paths=('/sqlalchemy/',)`.
#
#   For "only my code" — the most aggressive preset — combine the
#   builtins with `STRICT_USER_CODE_EXCLUDE_PATHS` (defined below) to
#   also drop stdlib + site-packages. Done deliberately, not by
#   default: dropping stdlib turns the icicle chart EMPTY for code
#   that hasn't been decorated with `@trace`, because the sampler's
#   leaf frames are almost always inside asyncio / framework code.
#
# Final filter list = `builtin_exclude_paths + exclude_paths`. A leaf
# matches if its file contains ANY substring in the combined list.
#
# Every production sampler does this in some form: py-spy has
# `--exclude`, GCP has the agent-skip filter.
BUILTIN_EXCLUDE_PATHS = (
    # The profiler observing itself — pure noise. The polling thread
    # is on-CPU exactly when SIGPROF fires it; the captured stack is
    # profiler internals.
    '/driftdockerprofiler/',
    '/_profiler.cpython',         # the compiled C++ extension's .so

    # Frozen importlib bootstrap — appears as `<frozen importlib._bootstrap>`
    # and `<frozen importlib._bootstrap_external>` in tracebacks. Always
    # noise; no actionable user signal.
    '<frozen ',
)

# Strictly-only-user-code preset. Users who want "show me ONLY my code"
# pass this (or augment it) via `exclude_paths=`. Kept out of the
# defaults because dropping stdlib + site-packages turns the icicle
# chart empty in apps that haven't decorated their hot methods with
# `@trace` — the sampler events all leaf in framework code.
#
# Usage::
#
#     driftdockerprofiler.start(
#         service='svc',
#         exclude_paths=driftdockerprofiler.STRICT_USER_CODE_EXCLUDE_PATHS,
#     )
STRICT_USER_CODE_EXCLUDE_PATHS = (
    '/lib/python3.',     # Python stdlib (catches /usr/lib, /usr/local/lib, venvs)
    '/site-packages/',   # third-party packages (fastapi, uvicorn, etc.)
)

logger = logging.getLogger(__name__)


def cpu_profiling_available():
  """Return True iff the native CPU profiler can be loaded on this install."""
  return cpu_profiler is not None


class Client:
  """Writes profiles to a local JSONL file.

  Two-phase init mirrors upstream: `Client()` then `client.config(...)`
  then `client.start()`. Upstream had this split because `setup_auth()`
  came in the middle (GCP credentials needed before `config()`); we
  keep the shape even though `setup_auth()` is gone, because it's the
  natural place to do per-deployment overrides via env vars between
  the two calls.
  """

  def __init__(self):
    # Backoff state for `_create_profile` failures. Reset on success,
    # advanced on failure. Same pattern upstream uses.
    self._backoff = backoff.Backoff()
    self._started = False
    self._profilers = None
    self._writer = None
    self._stop_event = threading.Event()
    self._polling_thread = None
    self._atexit_registered = False

  def config(self,
             service=None,
             service_version=None,
             output_path=None,
             period_ms=10,
             duration_ms=10_000,
             disable_cpu_profiling=False,
             disable_wall_profiling=False,
             pod=None,
             emit_mode='per_trace',
             builtin_exclude_paths=BUILTIN_EXCLUDE_PATHS,
             exclude_paths=()):
    """Sets up the client config.

    Mirrors `googlecloudprofiler.Client.config` — the GCP-only args
    (`project_id`, `discovery_service_url`) are replaced with the
    local-sink kwargs (`output_path`, `duration_ms`, `emit_mode`).

    Raises:
      ValueError: If `service` can't be determined, doesn't match the
        regex, no profiling mode is enabled, period_ms / duration_ms
        non-positive, or emit_mode is unknown.
    """
    if emit_mode not in _EMIT_MODES:
      raise ValueError(
          'emit_mode must be one of %r, got %r' % (_EMIT_MODES, emit_mode))
    if period_ms <= 0:
      raise ValueError('period_ms must be positive')
    if duration_ms <= 0:
      raise ValueError('duration_ms must be positive')

    self._profilers = {}
    self._config_cpu_profiling(disable_cpu_profiling, period_ms)
    self._config_wall_profiling(disable_wall_profiling, period_ms)
    if not self._profilers:
      raise ValueError('No profiling mode is enabled.')

    service = (service
               or os.environ.get('GAE_SERVICE')
               or os.environ.get('K_SERVICE'))
    if not service:
      raise ValueError(
          'Service name must be provided via configuration or '
          'GAE_SERVICE / K_SERVICE environment variable.')
    if not _SERVICE_RE.match(service):
      raise ValueError(
          'Service name "%s" does not match regular expression "%s"' % (
              service, _SERVICE_RE.pattern))

    service_version = (service_version
                       or os.environ.get('GAE_VERSION')
                       or os.environ.get('K_REVISION'))

    self._service = service
    self._service_version = service_version or ''
    self._pod = pod or os.environ.get('HOSTNAME') or socket.gethostname()
    self._duration_ms = duration_ms
    self._duration_ns = duration_ms * 1_000_000
    self._emit_mode = emit_mode
    # Two-layer filter: builtin defaults + user extras, concatenated.
    # Both are normalised to tuples-of-strings so accidental list mutation
    # by the caller doesn't surprise us.
    _builtins = tuple(str(p) for p in builtin_exclude_paths) if builtin_exclude_paths else ()
    _extras = tuple(str(p) for p in exclude_paths) if exclude_paths else ()
    self._exclude_paths = _builtins + _extras
    self._writer = JsonlWriter(output_path)
    # Round-robin index for `_create_profile`. Upstream got the next
    # profile type from the server; we cycle locally.
    self._next_profile_idx = 0

  def start(self):
    """Starts collecting profiles.

    Starts a daemon thread that calls `_create_profile()` and
    `_collect_and_upload_profile()` in a loop — same shape as upstream.
    The difference is that both methods now operate locally instead of
    talking to GCP.

    Raises:
      RuntimeError: If called from a non-main thread when WALL
        profiling is enabled (SIGALRM is only delivered to the main
        thread on CPython). Upstream raised a ValueError from
        signal.signal here; we promote that to a clearer error
        message earlier.
    """
    if self._started:
      logger.warning('Profiler already started, will not start again')
      return

    if 'WALL' in self._profilers:
      if threading.current_thread() is not threading.main_thread():
        raise RuntimeError(
            'Client.start() must be called from the main thread when '
            'WALL profiling is enabled (SIGALRM is only delivered to '
            'the main thread on CPython)')
      self._profilers['WALL'].register_handler()

    # Wire the deterministic-tracer module to our writer so any
    # `@trace`-decorated function call lands in the same JSONL stream
    # as the sampler events. Cleared in stop().
    tracer._configure(
        writer=self._writer,
        service=self._service,
        pod=self._pod,
        service_version=self._service_version,
    )

    self._stop_event.clear()
    self._polling_thread = threading.Thread(
        target=self._poll_profiler_service)
    self._polling_thread.name = 'Profiler API polling thread'
    self._polling_thread.daemon = True
    self._polling_thread.start()
    # Upstream relied on `daemon=True` to die on process exit — but
    # that doesn't flush the writer. Register a shutdown so the
    # last window's events make it to disk.
    if not self._atexit_registered:
      atexit.register(self._stop_at_exit)
      self._atexit_registered = True
    self._started = True
    logger.info(
        'Profiler started: service=%s period_ms=%d duration_ms=%d '
        'output=%s profilers=%s emit_mode=%s',
        self._service, self._duration_ms, self._duration_ms,
        self._writer.path, sorted(self._profilers), self._emit_mode)

  def stop(self, timeout=None):
    """Signal the polling thread to stop and join it. Idempotent.

    Not in upstream — its daemon thread had no shutdown path. We need
    one because (a) the JsonlWriter holds a buffer that should flush
    on exit, and (b) tests need to tear down between cases.

    The thread may be blocked inside `profiler.profile(duration_ns)`,
    which is uninterruptible — the default `timeout` covers one full
    window plus 2 seconds of slack.
    """
    if not self._started:
      return
    self._stop_event.set()
    if self._polling_thread is not None:
      if timeout is None:
        timeout = (self._duration_ms / 1000.0) + 2.0
      self._polling_thread.join(timeout=timeout)
      self._polling_thread = None
    # Disable the deterministic tracer BEFORE closing the writer —
    # otherwise a @trace'd call from another thread mid-shutdown
    # could still try to emit to a closed handle.
    tracer._reset()
    if self._writer is not None:
      self._writer.close()
    self._started = False
    logger.info('Profiler stopped')

  def _stop_at_exit(self):
    """atexit-safe shutdown — swallows errors so a failing stop()
    doesn't crash interpreter teardown."""
    try:
      self.stop()
    except Exception:  # pylint: disable=broad-except
      pass

  def _config_cpu_profiling(self, disable_cpu_profiling, period_ms):
    """Adds CPU profiler if supported and not disabled. Same as upstream."""
    cpu_profiling_supported = cpu_profiler is not None
    if not cpu_profiling_supported:
      logger.info('CPU profiling is not supported on the current Operating '
                  'System. Linux is the only supported Operating System.')
    elif disable_cpu_profiling:
      logger.info('CPU profiling is disabled by disable_cpu_profiling')
    else:
      self._profilers['CPU'] = cpu_profiler.CPUProfiler(period_ms)

  def _config_wall_profiling(self, disable_wall_profiling, period_ms):
    """Adds wall profiler if not disabled. Same as upstream."""
    if disable_wall_profiling:
      logger.info('Wall profiling is disabled by disable_wall_profiling')
    else:
      self._profilers['WALL'] = pythonprofiler.WallProfiler(period_ms)

  def _create_profile(self):
    """Synthesize the next profile-spec locally.

    Replaces upstream's CreateProfile RPC. Upstream's version BLOCKED
    waiting for the GCP backend to schedule a profile; we have no
    backend, so we round-robin through configured profile types every
    `duration_ms` ms.

    The RETURN SHAPE is preserved verbatim from upstream
    (`{'profileType', 'duration': {'seconds', 'nanos'}, 'name'}`) so
    `_collect_and_upload_profile()` reads the same as upstream's.

    Returns:
      A profile-spec dict.
    """
    profile_types = sorted(self._profilers.keys())
    profile_type = profile_types[self._next_profile_idx % len(profile_types)]
    self._next_profile_idx += 1
    return {
        'profileType': profile_type,
        'duration': {
            'seconds': self._duration_ms // 1000,
            'nanos': (self._duration_ms % 1000) * 1_000_000,
        },
        'name': 'local',
    }

  def _collect_and_upload_profile(self, profile):
    """Collects a profile and WRITES IT LOCALLY (was: uploads over HTTP).

    The try/except BaseException pattern is preserved verbatim from
    upstream. The body of the try is the only thing that changed:
    instead of `base64.b64encode(...)` + `self._profiler_service.patch(...)`,
    we run the profiler and call `_write_window()`.

    Single transient errors must not kill the daemon thread — same
    invariant upstream relied on.
    """
    profile_type = profile.get('profileType', '<unknown>')
    try:
      if profile_type not in self._profilers:
        logger.warning('Unexpected profile type: %s', profile_type)
        return

      # Upstream parsed the duration with protobuf's Duration message;
      # we use plain dict lookups (server-supplied was always a
      # `{'seconds', 'nanos'}` JSON object).
      duration = profile['duration']
      duration_ns = (int(duration.get('seconds', 0)) * _NANOS_PER_SEC
                     + int(duration.get('nanos', 0)))

      traces = self._profilers[profile_type].profile(duration_ns)
      window_end_ns = time.time_ns()
      self._write_window(profile_type, traces, window_end_ns)
    except BaseException:  # pylint: disable=broad-except
      logger.warning(
          'Failed to collect and write profile whose profile type is %s: %s',
          profile_type, traceback.format_exc())

  def _should_exclude(self, leaf_file):
    """Return True iff `leaf_file` matches any configured exclude pattern.

    Called once per unique trace (not per sample) — a cheap substring
    scan over a small fixed list (typically 2 entries). Profile-self
    filtering is the primary use; users can extend the list to drop
    stdlib, site-packages, or specific noisy modules.
    """
    if not self._exclude_paths:
      return False
    for pat in self._exclude_paths:
      if pat and pat in leaf_file:
        return True
    return False

  def _filter_traces(self, traces):
    """Drop traces whose leaf frame matches `exclude_paths`.

    We filter on the LEAF (frames[0]) because that's "what code is
    executing now" — if it's profiler internals, the entire stack is
    noise. Deeper frames may legitimately route through filtered
    paths on the way to user code; we don't drop those.
    """
    if not self._exclude_paths:
      return traces
    filtered = {}
    for trace, count in traces.items():
      if not trace:
        continue
      leaf = trace[0]
      # trace[0] is a (name, file, line) tuple.
      leaf_file = leaf[1] if len(leaf) > 1 else ''
      if self._should_exclude(leaf_file):
        continue
      filtered[trace] = count
    return filtered

  def _write_window(self, profile_type, traces, window_end_ns):
    """Local-write equivalent of upstream's base64 + PATCH step.

    Dispatches by `emit_mode`. `metrics.snapshot()` is called once
    here, at window close, and the values are reused for every line —
    keeps per-event cost flat and avoids syscalls from inside the
    SIGALRM/SIGPROF handlers (which is async-signal-unsafe for most
    of stdlib).
    """
    if not traces:
      return
    # Apply exclude_paths filter BEFORE the per-trace / bundle
    # dispatch — bundle mode needs the filter to short-circuit on an
    # empty result rather than emit an empty samples[] array.
    traces = self._filter_traces(traces)
    if not traces:
      return
    cpu, mem_bytes, mem_peak = metrics.snapshot()
    if self._emit_mode == 'bundle':
      self._write_bundle(profile_type, traces, window_end_ns,
                         cpu, mem_bytes, mem_peak)
    else:
      self._write_per_trace(profile_type, traces, window_end_ns,
                            cpu, mem_bytes, mem_peak)

  def _write_per_trace(self, profile_type, traces, window_end_ns,
                       cpu, memory_bytes, memory_peak_bytes):
    """Emit one JSONL line per unique stack."""
    profiler = self._profilers[profile_type]
    period_ns = profiler.period_ns
    duration_ns = self._duration_ns
    write = self._writer.emit
    # Internal profile_type is uppercase ('WALL', 'CPU') to match
    # upstream; JSONL `type` discriminator is lowercase
    # ('wall_trace', 'cpu_trace') per the event schema.
    event_type = profiler_json.per_trace_event_type(profile_type.lower())
    for trace, count in traces.items():
      event = {
          'type': event_type,
          'time': window_end_ns,
          'service': self._service,
          'pod': self._pod,
          'period_ns': period_ns,
          'duration_ns': duration_ns,
          'count': int(count),
          'cpu': cpu,
          'memory_bytes': memory_bytes,
          'memory_peak_bytes': memory_peak_bytes,
          'frames': frames_to_dicts(trace),
      }
      if self._service_version:
        event['service_version'] = self._service_version
      write(event)

  def _write_bundle(self, profile_type, traces, window_end_ns,
                    cpu, memory_bytes, memory_peak_bytes):
    """Emit one JSONL line per window carrying the whole `Profile`."""
    profiler = self._profilers[profile_type]
    builder = profiler_json.Builder()
    builder.populate_profile(
        traces,
        profile_type=profile_type.lower(),
        period_unit='nanoseconds',
        period=profiler.period_ns,
        duration_ns=self._duration_ns,
        time_ns=window_end_ns,
        service=self._service,
        pod=self._pod,
        service_version=self._service_version,
        cpu=cpu,
        memory_bytes=memory_bytes,
    )
    event = builder.to_dict()
    event['type'] = profiler_json.bundle_event_type(profile_type.lower())
    event['time'] = window_end_ns  # JsonlWriter rewrites int → ISO
    # Bundle events also get the peak — keep parity with per_trace.
    event['memory_peak_bytes'] = memory_peak_bytes
    self._writer.emit(event)

  def _poll_profiler_service(self):
    """Polls the (local) profile-spec generator. Forks upstream's
    `_poll_profiler_service`.

    Upstream had TWO nested retry loops:

      OUTER — wait for `_build_service()` (Discovery client) to come
              up. Retried forever with `build_service_backoff`. We
              dropped this — there's no service to build.
      INNER — forever: `_create_profile()` (with backoff on failure)
              → `_collect_and_upload_profile()`.

    We KEEP the inner loop verbatim — including the exponential
    backoff on `_create_profile` failures and the `try/except
    BaseException` wrap. `_create_profile` doesn't talk to the network
    anymore so it won't fail in practice, but the pattern stands so
    if anyone re-adds a remote sink, the resilience drops right back in.
    """
    logger.debug('Profiler has started')

    while not self._stop_event.is_set():
      profile = None
      while not profile and not self._stop_event.is_set():
        try:
          logger.debug('Starting to create profile')
          profile = self._create_profile()
          # Same as upstream: reset backoff after success.
          self._backoff.reset()
          logger.debug('Successfully created a %s profile',
                       profile['profileType'])
        except BaseException as e:  # pylint: disable=broad-except
          # Same as upstream: exponential backoff with optional
          # server-hinted retry delay. The local fork never has a
          # server hint; the exponential path covers everything.
          backoff_duration = self._backoff.next_backoff(e)
          logger.debug(
              'Failed to create profile (will retry after %.3fs): %s',
              backoff_duration, str(e))
          # `stop_event.wait` returns True if stop fired during the
          # sleep — short-circuit so we don't drag out shutdown by a
          # full backoff window. Upstream used a bare `time.sleep`.
          if self._stop_event.wait(backoff_duration):
            return

      if profile is not None:
        self._collect_and_upload_profile(profile)
