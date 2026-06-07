# facebook/react #14853 — await act(async () => ...)

**[View PR on GitHub](https://github.com/facebook/react/pull/14853)**

| | |
|---|---|
| **Author** | @threepointone |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @threepointone
> I hacked together an asynchronous version of `act(...)`, and it's kinda nice.

### @threepointone
> I implemented a cheap form of unrolling safety, so if a previous `act()` gets closed before any subsequent `act()` calls, a warning gets triggered.

### @threepointone
> can't guarantee batching after the first await in an act block

### @threepointone
> less restrictive than the sync model, and starts to feel more opt-in than opt-out

### @threepointone
> exposes a secret api on react dom to implement it

### @threepointone
> spoke with dan, moving the `act(...)` logic into ReactFiberScheduler

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
