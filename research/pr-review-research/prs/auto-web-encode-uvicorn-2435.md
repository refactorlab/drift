# encode/uvicorn #2435 — Support custom IOLOOPs

**[View PR on GitHub](https://github.com/encode/uvicorn/pull/2435)**

| | |
|---|---|
| **Author** | @gnir-work |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @graingert
> an importable loop factory should not take self.use_subprocess this is only needed to choose a selector event loop on windows

### @graingert
> there's some differences - we're not using the broken and deprecated policy system anymore so that means anyone using asyncio on windows from a thread will get the default asyncio.EventLoop in their asyncio.run calls, rather than the SelectorEventLoop.

### @Kludex
> Question to my future self, or others: Just to confirm, this is not a breaking change, given that `--loop` is currently not accepting a different loop other than `asyncio` and `uvloop`, right?

### @Kludex
> Reference for me later: python/cpython#122240

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
