"""wrapt-based method wrapping.

Each configured method is wrapped so every call emits TWO events sharing
a `call` id:

  - start: {call, qualname, service?, pod?, file?, line?, params, time}
  - end:   {call, qualname, service?, pod?, file?, line?, status, duration_ms, time, error?}

Consumers distinguish start vs end by presence of `params` (start-only) or
`duration_ms` (end-only) — there is no `phase` field.

Hot-path design:

  - Signature is introspected ONCE at wrap time; simple sigs skip bind_partial.
  - `include_*` flags collapse at wrap time into a precomputed `base` dict
    and into the choice of caller-capture function (`_find_caller_pair` vs
    `_no_caller_pair`), so the hot path has zero `if include_*` branches.
  - `call` is a UUID4 hex string — globally unique across processes/hosts,
    so events from multiple pods can be correlated without collisions.
  - Caller capture returns a 2-tuple unconditionally — hot path is a single
    `caller_file, caller_line = capture_caller()` unpack, no ifs.
"""
from __future__ import annotations

import importlib
import inspect
import logging
import os
import socket
import sys
import threading
import time
from collections.abc import Mapping
from typing import Any, Callable
from uuid import uuid4

import wrapt

from .config import Config, Method, load
from .writer import Writer

logger = logging.getLogger("drift.instrument")

_REDACTED = "***"
_MAX_STR = 1024
_MAX_DEPTH = 5            # cycle/depth guard for _to_jsonable
_MAX_CALLER_FRAMES = 16   # bound stack walk; deep stacks return None instead of looping

# Call-ID generator: UUID4 hex (32 chars, no dashes). Globally unique across
# processes and hosts, so a downstream collector can correlate start/end
# events from many pods without worrying about counter collisions.
def _next_call_id() -> str:
    return uuid4().hex

_state_lock = threading.Lock()
_writer: Writer | None = None
_wrapped: list[tuple[str, str, Any]] = []  # (module, attr, original)


class _NoopWriter(Writer):
    """Returned when DRIFT_DISABLED=1; no queue, no thread started."""

    def __init__(self) -> None:
        self._dropped = 0
        self._drop_lock = threading.Lock()
        self._closed = threading.Event()

    def emit(self, _event: dict[str, Any]) -> None:
        pass

    def close(self, _timeout: float = 2.0) -> None:
        self._closed.set()


# ---------------------------------------------------------------- public API

def install(config_path: str) -> Writer:
    """Read YAML, wrap targets, start the writer. Returns the Writer."""
    global _writer

    if os.environ.get("DRIFT_DISABLED") == "1":
        logger.info("drift disabled via DRIFT_DISABLED=1")
        return _NoopWriter()

    with _state_lock:
        if _writer is not None:
            _uninstall_locked()
        cfg = load(config_path)
        _writer = Writer(cfg.build_sink())
        for method in cfg.methods:
            _wrap_method(method, cfg, _writer)
        return _writer


def uninstall() -> None:
    """Restore originals; close the writer."""
    with _state_lock:
        _uninstall_locked()


def _uninstall_locked() -> None:
    """Must be called with _state_lock held."""
    global _writer
    for module_name, attr, original in _wrapped:
        try:
            mod = importlib.import_module(module_name)
            _setattr_dotted(mod, attr, original)
        except Exception as e:  # pragma: no cover
            logger.warning("unwrap failed for %s.%s: %s", module_name, attr, e)
    _wrapped.clear()
    if _writer is not None:
        _writer.close()
        _writer = None


# ---------------------------------------------------------------- wrapping

def _wrap_method(method: Method, cfg: Config, writer: Writer) -> None:
    module_name, attr = _split_target(method.target)
    try:
        mod = importlib.import_module(module_name)
    except ImportError as e:
        logger.warning("cannot import %s for target %s: %s", module_name, method.target, e)
        return
    try:
        original = _getattr_dotted(mod, attr)
    except AttributeError as e:
        logger.warning("target %s not found in %s: %s", attr, module_name, e)
        return

    _wrapped.append((module_name, attr, original))
    wrapper = _build_wrapper(
        method, cfg, writer, original,
        is_async=inspect.iscoroutinefunction(original),
    )
    try:
        wrapt.wrap_function_wrapper(module_name, attr, wrapper)
    except Exception as e:  # pragma: no cover
        logger.warning("failed to wrap %s.%s: %s", module_name, attr, e)


def _build_wrapper(method: Method, cfg: Config, writer: Writer, original: Any, *, is_async: bool):
    # --- captured-once constants -------------------------------------------
    pod = os.environ.get("HOSTNAME") or socket.gethostname()
    redact = cfg.redact
    service = cfg.service
    qualname = method.target

    include = cfg.include
    include_caller = include.caller  # the only include flag still consulted per-call

    try:
        sig: inspect.Signature | None = inspect.signature(original)
    except (ValueError, TypeError):
        sig = None

    capture_params = _build_capturer(sig, method.params, redact)

    # Compile specialized start/end event builders ONCE at wrap time.
    # All include-flag decisions (service/pod/caller) collapse into a
    # precomputed base dict and a specialized closure body — the hot path
    # below contains NO `if include_*` branches.
    build_start, build_end = _compile_event_builders(
        qualname=qualname,
        service=service,
        pod=pod,
        include_service=include.service,
        include_pod=include.pod,
        include_caller=include_caller,
    )

    # --- hot-path local aliases (faster than attribute lookups) -----------
    # `capture_caller` is BOUND HERE to one of two functions — both always
    # return a 2-tuple, so the hot path is a single unpack with zero ifs.
    capture_caller = _find_caller_pair if include_caller else _no_caller_pair

    emit = writer.emit
    perf_counter_ns = time.perf_counter_ns
    time_ns = time.time_ns
    new_id = _next_call_id   # UUID4 hex string

    def _on_start(instance: Any, args: tuple, kwargs: dict) -> tuple[str, int, str | None, int | None]:
        call_id = new_id()
        try:
            params = capture_params(instance, args, kwargs)
        except Exception as e:  # noqa: BLE001 — captures must never crash the app
            params = {"_capture_error": str(e)[:200]}

        # Zero per-call branches: capture_caller was specialized at wrap time
        # and is guaranteed to return (file, line) or (None, None).
        caller_file, caller_line = capture_caller()

        emit(build_start(call_id, params, time_ns(), caller_file, caller_line))
        return call_id, perf_counter_ns(), caller_file, caller_line

    def _on_end(
        call_id: str,
        t0_ns: int,
        caller_file: str | None,
        caller_line: int | None,
        exc: BaseException | None,
    ) -> None:
        duration_ms = round((perf_counter_ns() - t0_ns) / 1_000_000.0, 3)
        emit(build_end(call_id, time_ns(), caller_file, caller_line, exc, duration_ms))

    if is_async:
        async def async_wrapper(wrapped, instance, args, kwargs):
            call_id, t0, cf, cl = _on_start(instance, args, kwargs)
            try:
                result = await wrapped(*args, **kwargs)
            except BaseException as exc:
                _on_end(call_id, t0, cf, cl, exc)
                raise
            _on_end(call_id, t0, cf, cl, None)
            return result
        return async_wrapper

    def sync_wrapper(wrapped, instance, args, kwargs):
        call_id, t0, cf, cl = _on_start(instance, args, kwargs)
        try:
            result = wrapped(*args, **kwargs)
        except BaseException as exc:
            _on_end(call_id, t0, cf, cl, exc)
            raise
        _on_end(call_id, t0, cf, cl, None)
        return result
    return sync_wrapper


# ---------------------------------------------------------------- event builders

def _compile_event_builders(
    *,
    qualname: str,
    service: str,
    pod: str,
    include_service: bool,
    include_pod: bool,
    include_caller: bool,
) -> tuple[
    Callable[[str, dict[str, Any], int, str | None, int | None], dict[str, Any]],
    Callable[[str, int, str | None, int | None, BaseException | None, float], dict[str, Any]],
]:
    """Compile specialized start/end event builders for one wrapped method.

    All `include_*` flag decisions are made HERE, once, at wrap time. They
    collapse into:
      1. a precomputed `base` dict containing the static keys for this
         method's flag combination (`qualname`, plus any of `service`/`pod`);
      2. a builder body specialized on `include_caller` so the hot-path
         branch is gone when caller capture is disabled.

    There is no `phase` field — consumers distinguish start from end by
    presence of `params` (start) vs `duration_ms` (end). Saves ~30 ns/call
    and shrinks each line by ~16 bytes.
    """
    base: dict[str, Any] = {"qualname": qualname}
    if include_service:
        base["service"] = service
    if include_pod:
        base["pod"] = pod

    if include_caller:
        def build_start(
            call_id: str,
            params: dict[str, Any],
            time_ns_val: int,
            caller_file: str | None,
            caller_line: int | None,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["params"] = params
            ev["time"] = time_ns_val
            if caller_file is not None:
                ev["file"] = caller_file
                ev["line"] = caller_line
            return ev

        def build_end(
            call_id: str,
            time_ns_val: int,
            caller_file: str | None,
            caller_line: int | None,
            exc: BaseException | None,
            duration_ms: float,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["time"] = time_ns_val
            ev["status"] = "error" if exc else "ok"
            ev["duration_ms"] = duration_ms
            if caller_file is not None:
                ev["file"] = caller_file
                ev["line"] = caller_line
            if exc is not None:
                ev["error"] = f"{type(exc).__name__}: {exc}"
            return ev
    else:
        # Caller disabled at wrap time — these closures have ZERO branches
        # related to caller_file. The cf/cl args are accepted (to keep the
        # call signature stable) but never read.
        def build_start(
            call_id: str,
            params: dict[str, Any],
            time_ns_val: int,
            _caller_file: str | None,
            _caller_line: int | None,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["params"] = params
            ev["time"] = time_ns_val
            return ev

        def build_end(
            call_id: str,
            time_ns_val: int,
            _caller_file: str | None,
            _caller_line: int | None,
            exc: BaseException | None,
            duration_ms: float,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["time"] = time_ns_val
            ev["status"] = "error" if exc else "ok"
            ev["duration_ms"] = duration_ms
            if exc is not None:
                ev["error"] = f"{type(exc).__name__}: {exc}"
            return ev

    return build_start, build_end


# ---------------------------------------------------------------- param capture

def _build_capturer(
    sig: inspect.Signature | None,
    params_filter: list[str] | None,
    redact: tuple[str, ...],
) -> Callable[[Any, tuple, dict], dict[str, Any]]:
    """Compile a per-method param capturer specialized to the signature.

    Fast path (no *args / **kwargs): manual zip over positional names + dict
    iteration over kwargs, with precomputed redaction set. ~10x faster than
    `Signature.bind_partial` on a hot path.

    Slow path: falls back to bind_partial for variadic signatures.
    """
    if sig is None:
        return lambda _i, _a, _kw: {}

    parameters = sig.parameters
    has_variadic = any(
        p.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
        for p in parameters.values()
    )
    if has_variadic:
        return _make_bind_capturer(sig, params_filter, redact)

    positional_names: tuple[str, ...] = tuple(parameters)
    name_filter = frozenset(params_filter) if params_filter is not None else None
    # Precompute which positional names match the redaction denylist.
    denied_positional = frozenset(
        name for name in positional_names if _matches_denylist(name, redact)
    )

    def capture(instance: Any, args: tuple, kwargs: dict) -> dict[str, Any]:
        result: dict[str, Any] = {}
        # wrapt passes self/cls separately; skip the first param when present.
        offset = 1 if instance is not None and positional_names else 0
        if args:
            for name, value in zip(positional_names[offset:], args):
                if name_filter is not None and name not in name_filter:
                    continue
                result[name] = (
                    _REDACTED if name in denied_positional
                    else _to_jsonable(value, redact)
                )
        if kwargs:
            for name, value in kwargs.items():
                if name_filter is not None and name not in name_filter:
                    continue
                result[name] = (
                    _REDACTED if _matches_denylist(name, redact)
                    else _to_jsonable(value, redact)
                )
        return result

    return capture


def _make_bind_capturer(
    sig: inspect.Signature,
    params_filter: list[str] | None,
    redact: tuple[str, ...],
) -> Callable[[Any, tuple, dict], dict[str, Any]]:
    """Slow-but-correct capturer for variadic signatures."""
    name_filter = frozenset(params_filter) if params_filter is not None else None
    first_param = next(iter(sig.parameters), None)

    def capture(instance: Any, args: tuple, kwargs: dict) -> dict[str, Any]:
        bind_args = (instance, *args) if instance is not None else args
        try:
            bound = sig.bind_partial(*bind_args, **kwargs)
        except (TypeError, ValueError):
            return {}
        arguments = bound.arguments
        if instance is not None and first_param is not None:
            arguments.pop(first_param, None)
        items = arguments.items()
        if name_filter is not None:
            items = ((k, v) for k, v in items if k in name_filter)
        return {k: _redact_value(k, v, redact) for k, v in items}

    return capture


# ---------------------------------------------------------------- helpers

# Module-name prefixes whose frames are not "the caller":
#   drift.*    — our own wrappers
#   wrapt.*    — wrapt's dispatcher frames between caller and wrapper
#   asyncio.*  — event-loop internals above async wrappers
_SKIP_PREFIXES = ("drift.", "wrapt", "asyncio")


# Module-level constant tuple for the "no caller" case — reused on every
# call when caller capture is disabled OR when the stack walk hits its
# bound. No allocation per call.
_NO_CALLER: tuple[None, None] = (None, None)


def _no_caller_pair() -> tuple[None, None]:
    """Wrap-time-bound when `include.caller` is False. Always (None, None)."""
    return _NO_CALLER


def _find_caller_pair() -> tuple[str | None, int | None]:
    """Wrap-time-bound when `include.caller` is True.

    Returns `(filename, lineno)` of the first frame outside drift/wrapt/asyncio,
    or the `_NO_CALLER` constant when the walk exhausts `_MAX_CALLER_FRAMES`.

    The contract is "always returns a 2-tuple" so the hot path can do a single
    `caller_file, caller_line = capture_caller()` unpack with zero ifs.
    """
    frame = sys._getframe(1)  # skip _find_caller_pair itself
    for _ in range(_MAX_CALLER_FRAMES):
        if frame is None:
            return _NO_CALLER
        mod_name = frame.f_globals.get("__name__", "") or ""
        if not mod_name.startswith(_SKIP_PREFIXES):
            return (frame.f_code.co_filename, frame.f_lineno)
        frame = frame.f_back
    return _NO_CALLER


def _redact_value(key: str, value: Any, denylist: tuple[str, ...]) -> Any:
    if _matches_denylist(key, denylist):
        return _REDACTED
    return _to_jsonable(value, denylist)


def _to_jsonable(
    value: Any,
    denylist: tuple[str, ...],
    _depth: int = 0,
    _seen: set[int] | None = None,
) -> Any:
    """Convert value to JSON-safe form. Production-safe:

    * Scalars short-circuit (the overwhelming common case — zero overhead).
    * Cycle-safe: a dict that references itself returns "<cycle: dict>" instead
      of `RecursionError`. The `_seen` set is allocated lazily on the first
      nested container, so flat structures pay nothing.
    * Depth-bounded by `_MAX_DEPTH` — extreme nesting is summarized rather
      than recursed.
    """
    # Scalar fast path — covers the vast majority of values.
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value if len(value) <= _MAX_STR else value[:_MAX_STR] + "…"

    if _depth >= _MAX_DEPTH:
        return f"<depth-exceeded: {type(value).__name__}>"

    if isinstance(value, (Mapping, list, tuple, set, frozenset)):
        obj_id = id(value)
        if _seen is not None and obj_id in _seen:
            return f"<cycle: {type(value).__name__}>"
        # Allocate the seen-set lazily on the first nested container so flat
        # inputs (>99% of cases) skip this entirely.
        if _seen is None:
            _seen = {obj_id}
        else:
            _seen.add(obj_id)
        try:
            if isinstance(value, Mapping):
                return {
                    str(k): (
                        _REDACTED if _matches_denylist(str(k), denylist)
                        else _to_jsonable(v, denylist, _depth + 1, _seen)
                    )
                    for k, v in value.items()
                }
            return [_to_jsonable(v, denylist, _depth + 1, _seen) for v in value]
        finally:
            _seen.discard(obj_id)

    text = repr(value)
    return text if len(text) <= _MAX_STR else text[:_MAX_STR] + "…"


def _matches_denylist(key: str, denylist: tuple[str, ...]) -> bool:
    k = key.lower()
    return any(n in k for n in denylist)


def _split_target(target: str) -> tuple[str, str]:
    """Split `pkg.mod.Class.method` into ('pkg.mod', 'Class.method').

    The boundary is the first PascalCase segment.
    """
    parts = target.split(".")
    for i, segment in enumerate(parts):
        if segment and segment[0].isupper():
            return ".".join(parts[:i]), ".".join(parts[i:])
    return ".".join(parts[:-1]), parts[-1]


def _getattr_dotted(obj: Any, attr: str) -> Any:
    for name in attr.split("."):
        obj = getattr(obj, name)
    return obj


def _setattr_dotted(obj: Any, attr: str, value: Any) -> None:
    parts = attr.split(".")
    for name in parts[:-1]:
        obj = getattr(obj, name)
    setattr(obj, parts[-1], value)
