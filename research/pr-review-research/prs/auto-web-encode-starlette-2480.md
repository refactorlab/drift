# encode/starlette #2480 — Add type hints to `test_formparsers.py`

**[View PR on GitHub](https://github.com/encode/starlette/pull/2480)**

| | |
|---|---|
| **Author** | @TechNiick |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Kludex
> Why Any on those?

(Questioned the use of `typing.Any` for the `test_client_factory` parameter instead of a more specific type.)

### @Kludex
> I don't think `TestCase` is the right type here... 👀

(Challenged the type annotation for the `expectation` parameter, arguing `TestCase` was inappropriate.)

*Note: Most of this PR's review threads were rendered as resolved/collapsed and were not fully web-retrievable. The visible substantive feedback (both from reviewer @Kludex) is captured verbatim above; it focused on type-annotation accuracy rather than design trade-offs.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
