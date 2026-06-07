# encode/starlette #2814 — collect errors more reliably from websocket test client

**[View PR on GitHub](https://github.com/encode/starlette/pull/2814)**

| | |
|---|---|
| **Author** | @graingert |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Kludex
> Should we use the `if sys.version_info` here?

(Re: use of `Queue.shutdown()` on Python 3.13+. graingert argued the EOF approach should be maintained until a backport exists.)

### @Kludex
> Is there an analogous to EOF from the standard library on 3.13?

(graingert clarified that on Python 3.13 receiving from a shutdown queue raises an exception rather than returning a sentinel value.)

### @Kludex
> Why is the cancelled exception here? Is this because this except was removed? The addition of that `except` was on purpose, if I recall correctly.

(graingert explained the exception replaces the removed `websocket.should_close.is_set()` check, to detect intentional cancellation versus external task termination.)

### @Kludex
> Why it should be impossible? The `except BaseException as exc` below doesn't have a `pragma: no cover`, so I assume it's being hit?

(graingert noted the defensive line is unreachable under normal operation — only possible if `ws.receive()` is interrupted by a keyboard interrupt while awaiting queue messages.)

*Note: GitHub's review-thread prose was only partially web-retrievable; quoted lines are verbatim where shown, with the surrounding exchange paraphrased.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
