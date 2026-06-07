# tiangolo/sqlmodel #1806 — 👷 Replace `mypy` with `ty` in precommit

**[View PR on GitHub](https://github.com/tiangolo/sqlmodel/pull/1806)**

| | |
|---|---|
| **Author** | @svlandeg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @YuriiMotov
> Added a few suggestions in the comments. Please, take a look)

### @YuriiMotov
> LGTM! Just one moment with removing `tests/test_select_typing.py` from command

### @svlandeg
> Putting this back in draft as I have a look into updating `ty` to 0.0.25, which generates a new host of errors.

### @svlandeg
> I updated the PR to use `ty` 0.0.25 which is actually nicer. And now we also error on warnings.

### @YuriiMotov
> For context: [#1806 (comment)]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
