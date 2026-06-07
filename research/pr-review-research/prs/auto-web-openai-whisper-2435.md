# openai/whisper #2435 — PEP 621: Migrate from setup.py to pyproject.toml

**[View PR on GitHub](https://github.com/openai/whisper/pull/2435)**

| | |
|---|---|
| **Author** | @cclauss |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cav71
> I think there's still the numba issue (it is limited to <3.13): RuntimeError: Cannot install on Python version 3.13.0; only versions >=3.9,<3.13 are supported.

### @ccoenen
> numba 0.61.0 is supposed to be compatible with python 3.13 (released a couple of days ago)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*

> Note: this PR's discussion was sparse on substantive technical debate; most conversation centered on the numba/Python 3.13 dependency constraint above, resolved by numba's own release.
