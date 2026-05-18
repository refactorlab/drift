"""Sinks: where a batch of serialized events ultimately goes.

A sink is anything callable that accepts a `list[bytes]` (one entry per
newline-terminated JSON event) and writes them somewhere. Strategy pattern:
the Writer doesn't know or care where the bytes end up.

In this project there is exactly one sink: FileSink. It writes JSONL to a
path on a shared volume; the observability-server tails that file.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Protocol

logger = logging.getLogger("drift.sinks")


class Sink(Protocol):
    def __call__(self, batch: list[bytes]) -> None: ...
    def close(self) -> None: ...


class FileSink:
    """Append batches to a JSONL file on a shared volume."""

    def __init__(self, path: str, buffer_bytes: int = 64 * 1024) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        self._file = open(p, "ab", buffering=buffer_bytes)

    def __call__(self, batch: list[bytes]) -> None:
        try:
            self._file.writelines(batch)
            self._file.flush()
        except OSError as e:  # pragma: no cover
            logger.warning("file sink write failed: %s", e)

    def close(self) -> None:
        try:
            self._file.flush()
            self._file.close()
        except OSError:  # pragma: no cover
            pass
