"""wrapt-based method wrapping.

Each configured method is wrapped so every call emits TWO events sharing
a `call` id:

  - start: {call, qualname, service?, pod?, file?, line?, params, time,
            args_bytes?, load?}
  - end:   {call, qualname, service?, pod?, file?, line?, status,
            duration_ms, time, load?, error?}

Consumers distinguish start vs end by presence of `params` (start-only) or
`duration_ms` (end-only) — there is no `phase` field.

Hot-path design:

  - Signature is introspected ONCE at wrap time; simple sigs skip bind_partial.
  - `include_*` flags collapse at wrap time into a precomputed `base` dict
    and into the choice of caller-capture / sizeof / load functions
    (`_no_caller_pair`, `_zero_bytes`, `_zero_load`), so the hot path has
    zero `if include_*` branches.
  - `call` is a UUID4 hex string — globally unique across processes/hosts,
    so events from multiple pods can be correlated without collisions.
  - Caller capture returns a 2-tuple unconditionally — hot path is a single
    `caller_file, caller_line = capture_caller()` unpack, no ifs.
  - System load is sampled at most once per second (TTL cache), shared
    across all wrapped methods and threads. A single thread refreshes it;
    the worst race is one redundant `os.getloadavg()` syscall.

Call-graph mode (`config.call_graph.modules`):

  At install time every top-level function and class method defined inside
  each listed module is auto-wrapped. Auto-wrapped methods record call/return
  events with `params: {}`. Methods that ALSO appear in `config.methods` are
  left alone for the explicit entry, which keeps its `params` filter. This is
  intentionally a wrap-time discovery (not `sys.setprofile`) so there is zero
  per-call cost beyond the methods we actually decided to record.
"""
from __future__ import annotations

import atexit
import importlib
import inspect
import logging
import os
import signal
import socket
import sys
import threading
import time
from collections.abc import Mapping
from typing import Any, Callable, Iterator
from uuid import uuid4

import wrapt

from . import s3_upload
from .config import CallGraph, Config, Method, S3Config, load
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

# End-of-run S3 upload state. Populated by `install()` and consumed by
# `_uninstall_locked()` once the writer has fully drained. `None` when the
# active config has no `s3:` block, in which case all of the hook machinery
# below is a no-op.
_active_s3: S3Config | None = None
_active_log_path: str | None = None
_active_service: str | None = None

# Exit hooks (atexit + SIGINT/SIGTERM) are installed at most once per
# interpreter to avoid duplicate uploads when the user calls `install()`
# repeatedly (eg. for tests).
_hooks_installed = False
_prev_signal_handlers: dict[int, Any] = {}


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
    global _writer, _active_s3, _active_log_path, _active_service

    if os.environ.get("DRIFT_DISABLED") == "1":
        logger.info("drift disabled via DRIFT_DISABLED=1")
        return _NoopWriter()

    with _state_lock:
        if _writer is not None:
            _uninstall_locked()
        cfg = load(config_path)
        _writer = Writer(cfg.build_sink())
        _active_s3 = cfg.s3
        _active_log_path = cfg.log_path
        _active_service = cfg.service

        # Explicit methods first — they may carry a `params` filter that
        # call-graph auto-wrap must not override.
        explicit_targets: set[str] = set()
        for method in cfg.methods:
            _wrap_method(method, cfg, _writer)
            explicit_targets.add(method.target)

        for target in _discover_call_graph_targets(cfg.call_graph):
            if target in explicit_targets:
                continue
            # `params=[]` → capturer emits `{}` for every call.
            _wrap_method(Method(target=target, params=[]), cfg, _writer)

        if cfg.s3 is not None:
            _install_exit_hooks_once()

        return _writer


def uninstall() -> None:
    """Restore originals; close the writer."""
    with _state_lock:
        _uninstall_locked()


def _uninstall_locked() -> None:
    """Must be called with _state_lock held."""
    global _writer, _active_s3, _active_log_path, _active_service
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

    # Writer is fully drained — safe to ship the file. Failures are caught
    # inside `s3_upload.upload` so the host process can never crash here.
    if _active_s3 is not None and _active_log_path is not None:
        try:
            s3_upload.upload(
                _active_log_path,
                _active_s3,
                service=_active_service or "drift",
            )
        except Exception as e:  # belt-and-braces; upload() should never raise
            logger.warning("drift s3 upload raised unexpectedly: %s", e)
    _active_s3 = None
    _active_log_path = None
    _active_service = None


# ---------------------------------------------------------------- exit hooks

def _install_exit_hooks_once() -> None:
    """Register `atexit` + SIGINT/SIGTERM handlers so the local log file is
    shipped to S3 even when the host process exits via signal.

    Idempotent: only the first call wins per interpreter. Subsequent calls
    (eg. when tests re-install with a different config) are no-ops.
    """
    global _hooks_installed
    if _hooks_installed:
        return
    atexit.register(_shutdown_for_exit)
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            prev = signal.signal(sig, _handle_signal)
        except (ValueError, OSError):
            # Not on the main thread, or signal unsupported on this platform.
            continue
        _prev_signal_handlers[sig] = prev
    _hooks_installed = True


def _shutdown_for_exit() -> None:
    """atexit entrypoint — calls uninstall() under a guard so a second hook
    fire (eg. atexit after a signal handler) is a no-op."""
    try:
        uninstall()
    except Exception as e:  # pragma: no cover
        logger.warning("drift shutdown handler failed: %s", e)


def _handle_signal(signum: int, frame: Any) -> None:
    """SIGTERM/SIGINT handler. Run our shutdown, then chain to whatever the
    process had registered before us (or fall back to the default action)."""
    _shutdown_for_exit()
    prev = _prev_signal_handlers.get(signum)
    if callable(prev) and prev not in (signal.SIG_DFL, signal.SIG_IGN):
        try:
            prev(signum, frame)
            return
        except Exception:  # pragma: no cover
            pass
    # Restore default and re-raise so the process exits with the expected
    # signal status (eg. SIGTERM → 143).
    try:
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)
    except Exception:  # pragma: no cover
        pass


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
    # All include-flag decisions (service/pod/caller/args_bytes/cpu) collapse
    # into a precomputed base dict + specialized closure body so the hot
    # path contains NO `if include_*` branches.
    build_start, build_end = _compile_event_builders(
        qualname=qualname,
        service=service,
        pod=pod,
        include_service=include.service,
        include_pod=include.pod,
        include_caller=include_caller,
        include_args_bytes=include.args_bytes,
        include_cpu=include.cpu,
    )

    # --- hot-path local aliases (faster than attribute lookups) -----------
    # Each of these is BOUND HERE to either the real or zero implementation,
    # so the per-call path is a straight function call — no if-flag branches.
    capture_caller = _find_caller_pair if include_caller else _no_caller_pair
    measure_args_bytes = _args_bytes if include.args_bytes else _zero_bytes
    measure_load = _cached_load if include.cpu else _zero_load

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
        # Cheap measurements: `measure_args_bytes` is O(arity) shallow getsizeof;
        # `measure_load` is a TTL-cached int compare with a 1-sec refresh.
        ab = measure_args_bytes(args, kwargs)
        load = measure_load()

        emit(build_start(call_id, params, time_ns(), caller_file, caller_line, ab, load))
        return call_id, perf_counter_ns(), caller_file, caller_line

    def _on_end(
        call_id: str,
        t0_ns: int,
        caller_file: str | None,
        caller_line: int | None,
        exc: BaseException | None,
    ) -> None:
        duration_ms = round((perf_counter_ns() - t0_ns) / 1_000_000.0, 3)
        load = measure_load()
        emit(build_end(call_id, time_ns(), caller_file, caller_line, exc, duration_ms, load))

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
    include_args_bytes: bool,
    include_cpu: bool,
) -> tuple[
    Callable[[str, dict[str, Any], int, str | None, int | None, int, float], dict[str, Any]],
    Callable[[str, int, str | None, int | None, BaseException | None, float, float], dict[str, Any]],
]:
    """Compile specialized start/end event builders for one wrapped method.

    All `include_*` flag decisions are made HERE, once, at wrap time. They
    collapse into:
      1. a precomputed `base` dict containing the static keys for this
         method's flag combination (`qualname`, plus any of `service`/`pod`);
      2. a builder body specialized on `include_caller` so the hot-path
         branch is gone when caller capture is disabled;
      3. closure-captured `include_args_bytes` / `include_cpu` flags — these
         are read once via `LOAD_DEREF` then branched. The values themselves
         (`ab`, `load`) are wrap-time-bound to no-op producers when disabled,
         so they cost ~1 ns to compute, but skipping the dict-write avoids
         the per-line bytes downstream.

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
            args_bytes_val: int,
            load_val: float,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["params"] = params
            ev["time"] = time_ns_val
            if caller_file is not None:
                ev["file"] = caller_file
                ev["line"] = caller_line
            if include_args_bytes:
                ev["args_bytes"] = args_bytes_val
            if include_cpu:
                ev["load"] = load_val
            return ev

        def build_end(
            call_id: str,
            time_ns_val: int,
            caller_file: str | None,
            caller_line: int | None,
            exc: BaseException | None,
            duration_ms: float,
            load_val: float,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["time"] = time_ns_val
            ev["status"] = "error" if exc else "ok"
            ev["duration_ms"] = duration_ms
            if caller_file is not None:
                ev["file"] = caller_file
                ev["line"] = caller_line
            if include_cpu:
                ev["load"] = load_val
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
            args_bytes_val: int,
            load_val: float,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["params"] = params
            ev["time"] = time_ns_val
            if include_args_bytes:
                ev["args_bytes"] = args_bytes_val
            if include_cpu:
                ev["load"] = load_val
            return ev

        def build_end(
            call_id: str,
            time_ns_val: int,
            _caller_file: str | None,
            _caller_line: int | None,
            exc: BaseException | None,
            duration_ms: float,
            load_val: float,
        ) -> dict[str, Any]:
            ev = base.copy()
            ev["call"] = call_id
            ev["time"] = time_ns_val
            ev["status"] = "error" if exc else "ok"
            ev["duration_ms"] = duration_ms
            if include_cpu:
                ev["load"] = load_val
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


# ---------------------------------------------------------------- args size

# Local alias makes the hot path one LOAD_FAST instead of LOAD_ATTR.
_getsizeof = sys.getsizeof


def _args_bytes(args: tuple, kwargs: dict) -> int:
    """Shallow memory footprint of input args + kwargs (bytes).

    `sys.getsizeof` is a C built-in that returns the object's own size
    excluding referenced objects, so this is O(arity) — typically <10 items.
    Deep recursion is intentionally NOT used: walking arbitrary user payloads
    could be unbounded and would defeat the "no perf hit" goal. Treat the
    value as a footprint signal, not a deep accounting.
    """
    n = _getsizeof(args) + _getsizeof(kwargs)
    for v in args:
        n += _getsizeof(v)
    for v in kwargs.values():
        n += _getsizeof(v)
    return n


def _zero_bytes(_args: tuple, _kwargs: dict) -> int:
    """Wrap-time-bound when `include.args_bytes` is False."""
    return 0


# ---------------------------------------------------------------- system load

# Refresh the load average at most once per second. The cache is global —
# every wrapped method shares one syscall budget.
_LOAD_TTL_NS: int = 1_000_000_000
_last_load_check_ns: int = 0
_last_load_value: float = 0.0


def _cached_load() -> float:
    """1-second-cached system 1-min load average.

    Reads `os.getloadavg()[0]` at most once per second across the whole
    process. The TTL check is intentionally lock-free: under the GIL the
    update is race-safe, and in free-threaded Python the worst race is one
    redundant syscall — never a crash, never a torn read.

    Returns 0.0 on platforms where `os.getloadavg` is unavailable (Windows)
    or fails (sandboxed environments).
    """
    global _last_load_check_ns, _last_load_value
    now = time.monotonic_ns()
    if now - _last_load_check_ns > _LOAD_TTL_NS:
        try:
            _last_load_value = os.getloadavg()[0]
        except (OSError, AttributeError):
            _last_load_value = 0.0
        _last_load_check_ns = now
    return _last_load_value


def _zero_load() -> float:
    """Wrap-time-bound when `include.cpu` is False."""
    return 0.0


# ---------------------------------------------------------------- call graph

def _discover_call_graph_targets(cg: CallGraph) -> Iterator[str]:
    """Yield dotted-path targets for every function/method to auto-wrap.

    For each module listed under `call_graph.modules`, import it and walk
    its top-level namespace. Yield:

      - top-level `def` / `async def` whose `__module__` matches (skipping
        re-exports from other modules),
      - methods of top-level classes whose `__module__` matches.

    Names starting with `_` are skipped (dunders, conventionally-private).
    Properties, staticmethod/classmethod descriptors, and non-function
    callables are skipped — wrapt would not have a clean attribute path
    for them anyway.
    """
    for module_name in cg.modules:
        try:
            mod = importlib.import_module(module_name)
        except ImportError as e:
            logger.warning("call_graph: cannot import %s: %s", module_name, e)
            continue
        for name, obj in list(vars(mod).items()):
            if name.startswith("_"):
                continue
            if inspect.isfunction(obj) or inspect.iscoroutinefunction(obj):
                if getattr(obj, "__module__", None) == module_name:
                    yield f"{module_name}.{name}"
            elif inspect.isclass(obj):
                if getattr(obj, "__module__", None) != module_name:
                    continue
                for attr_name, attr_obj in list(vars(obj).items()):
                    if attr_name.startswith("_"):
                        continue
                    if inspect.isfunction(attr_obj) or inspect.iscoroutinefunction(attr_obj):
                        yield f"{module_name}.{name}.{attr_name}"
