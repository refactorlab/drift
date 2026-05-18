"""Config loader.

Schema::

    service: my-service                            # required
    log_path: drift/logs/events.log                # FileSink path (default)
    redact: [password, token, secret]

    # Per-field toggles — all default to true. Set false to omit from events.
    include:
      pod: true
      service: true
      caller: true       # caller's file + line (added as `file`, `line`)
      args_bytes: true   # shallow memory footprint of input args (bytes)
      cpu: true          # 1-minute system load average (cached 1s)

    # Auto-wrap every function/method defined in the listed modules. Wrapped
    # methods record call/return events with `params: {}`. Entries explicitly
    # listed under `methods` win — those keep their `params` filter.
    call_graph:
      modules: [orders, app]

    # Optional: ship the local `log_path` to S3 at end-of-run (atexit) or on
    # SIGINT/SIGTERM. Backends are probed in order: boto3 → requests → urllib
    # (stdlib), so no new dependency is added. Credentials fall back to
    # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.
    s3:
      bucket: my-bucket             # required when `s3` is set
      prefix: drift                 # optional object-key prefix
      region: us-east-1             # default
      access_key_id: AKIA...        # optional, falls back to env
      secret_access_key: ...        # optional, falls back to env

    methods:
      - orders.OrderService.create
      - orders.OrderService.charge
      - { target: orders.OrderService.ship, params: [order_id] }
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

from .sinks import FileSink, Sink

# Matches ${VAR} or ${VAR:-default}. Mirrors compose/k8s conventions.
_ENV_VAR_RE = re.compile(r"\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}")

DEFAULT_REDACT = ("password", "token", "authorization", "api_key", "secret", "ssn")
DEFAULT_LOG_PATH = "drift/logs/events.log"
DEFAULT_S3_REGION = "us-east-1"


@dataclass(frozen=True)
class Include:
    """Per-field include flags. All default true; set false to drop the field.

    `caller=True` adds the call-site as `file` (path) + `line` (int) to every
    event. The wrapped method's definition location is not emitted — only the
    call site, which is what consumers actually want when tracing flow.

    `args_bytes=True` adds a shallow memory-footprint estimate of the input
    args+kwargs (`sys.getsizeof` summed over container and top-level elements).
    Shallow on purpose — deep recursion would be unbounded on user payloads.

    `cpu=True` adds the system's 1-minute load average (`load` field) to each
    event. The value is cached for 1 second so high-frequency calls share a
    single syscall. Falls back to 0.0 on platforms without `os.getloadavg`.
    """
    pod: bool = True
    service: bool = True
    caller: bool = True
    args_bytes: bool = True
    cpu: bool = True


@dataclass(frozen=True)
class CallGraph:
    """Auto-wrap configuration.

    `modules` is a list of import paths. At install time, each module is
    imported and every top-level function or class method defined IN that
    module (`__module__ == module_name`) is wrapped with an empty params
    filter, so the resulting events carry call/return + timing but no
    captured arguments.

    Names starting with `_` are skipped (dunders, private). Methods that
    also appear in `Config.methods` are left to the explicit entry, which
    keeps its `params` configuration.
    """
    modules: tuple[str, ...] = ()


@dataclass
class Method:
    target: str
    params: list[str] | None = None


@dataclass(frozen=True)
class S3Config:
    """End-of-run S3 upload target.

    `bucket` is the only required field. Credentials fall back to the
    standard AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
    env vars so the YAML stays committable.

    The final object key is `{prefix}/{service}/{YYYY-MM-DD}/{HHMMSS}-{host}-{pid}.log`.
    """
    bucket: str
    prefix: str = ""
    region: str = DEFAULT_S3_REGION
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    session_token: Optional[str] = None


@dataclass
class Config:
    service: str
    redact: tuple[str, ...] = DEFAULT_REDACT
    methods: list[Method] = field(default_factory=list)
    log_path: str = DEFAULT_LOG_PATH
    include: Include = field(default_factory=Include)
    call_graph: CallGraph = field(default_factory=CallGraph)
    s3: Optional[S3Config] = None

    def build_sink(self) -> Sink:
        return FileSink(self.log_path)


def load(path: str | Path) -> Config:
    text = _expand_env_vars(Path(path).read_text())
    raw = yaml.safe_load(text)
    if not isinstance(raw, dict):
        raise ValueError("drift config must be a YAML mapping at top level")

    service = raw.get("service")
    if not service:
        raise ValueError("drift config: 'service' is required")

    methods = [_parse_method(m, i) for i, m in enumerate(raw.get("methods") or [])]

    return Config(
        service=service,
        redact=tuple(raw.get("redact") or DEFAULT_REDACT),
        methods=methods,
        log_path=raw.get("log_path", DEFAULT_LOG_PATH),
        include=_parse_include(raw.get("include")),
        call_graph=_parse_call_graph(raw.get("call_graph")),
        s3=_parse_s3(raw.get("s3")),
    )


def _parse_include(raw: object) -> Include:
    if raw is None:
        return Include()
    if not isinstance(raw, dict):
        raise ValueError("drift config: 'include' must be a mapping")
    # Unknown keys (including legacy `file`) are ignored to keep the schema
    # forward-compatible.
    return Include(
        pod=bool(raw.get("pod", True)),
        service=bool(raw.get("service", True)),
        caller=bool(raw.get("caller", True)),
        args_bytes=bool(raw.get("args_bytes", True)),
        cpu=bool(raw.get("cpu", True)),
    )


def _parse_call_graph(raw: object) -> CallGraph:
    if raw is None:
        return CallGraph()
    if not isinstance(raw, dict):
        raise ValueError("drift config: 'call_graph' must be a mapping")
    modules = raw.get("modules") or ()
    if not isinstance(modules, (list, tuple)):
        raise ValueError("drift config: 'call_graph.modules' must be a list")
    return CallGraph(modules=tuple(str(m) for m in modules))


def _parse_s3(raw: object) -> Optional[S3Config]:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("drift config: 's3' must be a mapping")
    bucket = raw.get("bucket")
    if not bucket:
        raise ValueError("drift config: 's3.bucket' is required when 's3' is set")
    return S3Config(
        bucket=str(bucket),
        prefix=str(raw.get("prefix") or ""),
        region=str(raw.get("region") or DEFAULT_S3_REGION),
        access_key_id=_opt_str(raw.get("access_key_id")),
        secret_access_key=_opt_str(raw.get("secret_access_key")),
        session_token=_opt_str(raw.get("session_token")),
    )


def _opt_str(v: object) -> Optional[str]:
    if v is None or v == "":
        return None
    return str(v)


def _expand_env_vars(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        default = match.group(2) or ""
        return os.environ.get(name, default)
    return _ENV_VAR_RE.sub(replace, text)


def _parse_method(entry: object, idx: int) -> Method:
    if isinstance(entry, str):
        return Method(target=entry)
    if isinstance(entry, dict):
        target = entry.get("target")
        if not target:
            raise ValueError(f"methods[{idx}]: 'target' required")
        params = entry.get("params")
        if params is not None and not isinstance(params, list):
            raise ValueError(f"methods[{idx}].params must be a list")
        return Method(target=target, params=params)
    raise ValueError(f"methods[{idx}]: must be string or mapping, got {type(entry).__name__}")
