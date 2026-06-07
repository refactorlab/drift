# aio-libs/aiohttp #8089 — 💅 Propagate error causes via asyncio protocols

**[View PR on GitHub](https://github.com/aio-libs/aiohttp/pull/8089)**

| | |
|---|---|
| **Author** | @webknjaz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: Several inline review threads (by @Dreamsorcerer and self-review by @webknjaz on `helpers.py`, `streams.py`, and `client_proto.py`) showed "Uh oh! There was an error while loading" on the web-fetched page, so their verbatim prose was not retrievable. The reviewer names and the web-retrievable prose are captured below.

### @webknjaz
> I expect that this needs polishing, of course. Especially since I didn't even bother touching the tests. Surprisingly, only 6 failed

### @bdraco
> I had to revert back right away when testing on production due to: aiohttp.client_exceptions.NonHttpUrlClientError: wss://192.168.209.164/proxy/protect/ws/updates?lastUpdateId=80f54055-84de-4e15-95d7-80cac46aafbd

### @Dreamsorcerer
> I thought that PR was only merged into 3.10?

### @bdraco
> Larger install is working well. No regressions observed. I'm about to leave town for the weekend.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
