"""Config loader.

Schema::

    service: my-service                            # required
    log_path: /trace/events.log                    # FileSink path (default)
    redact: [password, token, secret]

    # Per-field toggles — all default to true. Set false to omit from events.
    include:
      pod: true
      service: true
      caller: true     # caller's file + line (added as `file`, `line`)

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

import yaml

from .sinks import FileSink, Sink

# Matches ${VAR} or ${VAR:-default}. Mirrors compose/k8s conventions.
_ENV_VAR_RE = re.compile(r"\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}")

DEFAULT_REDACT = ("password", "token", "authorization", "api_key", "secret", "ssn")
DEFAULT_LOG_PATH = "/trace/events.log"


@dataclass(frozen=True)
class Include:
    """Per-field include flags. All default true; set false to drop the field.

    `caller=True` adds the call-site as `file` (path) + `line` (int) to every
    event. The wrapped method's definition location is not emitted — only the
    call site, which is what consumers actually want when tracing flow.
    """
    pod: bool = True
    service: bool = True
    caller: bool = True


@dataclass
class Method:
    target: str
    params: list[str] | None = None


@dataclass
class Config:
    service: str
    redact: tuple[str, ...] = DEFAULT_REDACT
    methods: list[Method] = field(default_factory=list)
    log_path: str = DEFAULT_LOG_PATH
    include: Include = field(default_factory=Include)

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
    )


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
