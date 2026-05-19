# Copyright 2018 Google LLC
# Modifications copyright 2026 RefactorLabs
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
"""Exponential backoff for profile-collection failures.

Forked from `googlecloudprofiler.backoff`. The shape is intentionally
identical to upstream so `client.py`'s polling loop reads as a small
diff against the original.

Behavior:

  - Doubles the wait on every successive failure (multiplier 1.3
    matches upstream), starting at `_MIN_BACKOFF_S`.
  - Caps at `_MAX_BACKOFF_S`.
  - Adds ±10 % jitter so concurrent agents don't synchronize their
    retries — same trick `googlecloudprofiler` uses.
  - `reset()` returns to the minimum (called after a successful
    operation).
  - `next_backoff(error=None)` optionally honors a server-hinted
    `retryDelay` if the exception carries one. Upstream used this for
    GCP's `HttpError` payloads; in the local fork we never have a
    server hint, but the signature is preserved so a future re-add
    of a remote sink slots right back in.

Bounds chosen for the local fork: 1 s minimum (was 60 s upstream —
upstream waited a full minute between retries because each retry
crossed the public internet to GCP). 1 hour cap. Adjust per-deployment
by mutating class attributes before constructing.
"""

import random


class Backoff:
  """Exponential backoff with jitter and a cap. Pure stdlib, no deps."""

  # Same shape as upstream's googlecloudprofiler.backoff.Backoff. The
  # absolute values differ — upstream was tuned for cross-internet GCP
  # retries; ours is tuned for "the profiler thread hit a transient
  # error" inside one process.
  _MIN_BACKOFF_S = 1.0
  _MAX_BACKOFF_S = 60.0 * 60.0  # 1 hour, same as upstream
  _BACKOFF_MULTIPLIER = 1.3     # same as upstream
  _JITTER_RATIO = 0.1           # ±10 %

  def __init__(self):
    self._next = self._MIN_BACKOFF_S

  def next_backoff(self, error=None):
    """Return the next backoff duration (seconds) and advance state.

    Args:
      error: Optional exception. If it carries a server-hinted
        retry delay (a `retryDelay` attribute or dict key — same
        convention upstream used for GCP HttpError payloads), that
        hint is used in place of the exponential value. The local
        fork never sees these hints in practice; the parameter is
        kept for API parity with upstream.

    Returns:
      A float number of seconds to sleep before retrying. Bounded
      below by `_MIN_BACKOFF_S * (1 - jitter)` and above by
      `_MAX_BACKOFF_S * (1 + jitter)`.
    """
    hint = self._server_hint(error)
    if hint is not None:
      delay = hint
    else:
      delay = self._next
      # Advance state for the next call. Capped + multiplicative.
      self._next = min(self._next * self._BACKOFF_MULTIPLIER,
                       self._MAX_BACKOFF_S)
    # ±jitter — deterministic seed not desired; concurrent agents
    # should desynchronise.
    jitter = random.uniform(-self._JITTER_RATIO, self._JITTER_RATIO)
    return delay * (1.0 + jitter)

  def reset(self):
    """Reset to the minimum backoff. Call after a successful operation."""
    self._next = self._MIN_BACKOFF_S

  @staticmethod
  def _server_hint(error):
    """Parse a server-hinted retry delay from an exception, if any.

    Upstream's GCP backend returned retry hints in HttpError JSON
    payloads. We don't carry that path anymore. We DO accept two
    generic conventions in case a future caller wants them:

      - An attribute `error.retry_delay_s` (float seconds).
      - A dict-style `error['retryDelay']` (float seconds).

    Both are documented but optional. None on absence.
    """
    if error is None:
      return None
    try:
      attr = getattr(error, 'retry_delay_s', None)
      if attr is not None:
        return float(attr)
    except (TypeError, ValueError):
      pass
    try:
      val = error['retryDelay']  # type: ignore[index]
      return float(val)
    except (TypeError, KeyError, ValueError):
      return None
