"""drift — minimal method-tracing.

Usage:
    import drift
    drift.install("/etc/drift/config.yaml")

That's the entire user-facing API. Every method listed in the YAML config
will be wrapped; each call emits two events to the configured log file:

    {"call":"<uuid>","method":"X.foo","params":{...},"time":"...","phase":"start"}
    {"call":"<uuid>","method":"X.foo","time":"...","phase":"end",
     "status":"ok|error","duration_ms":1.2}
"""
from .instrument import install, uninstall

__all__ = ["install", "uninstall"]
