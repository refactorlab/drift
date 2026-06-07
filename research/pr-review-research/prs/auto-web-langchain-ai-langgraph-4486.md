# langchain-ai/langgraph #4486 — Cache nodes/tasks

**[View PR on GitHub](https://github.com/langchain-ai/langgraph/pull/4486)**

| | |
|---|---|
| **Author** | @nfcampos |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sydney-runkle
> Really exciting feature! A few general notes - wanting a bit more clarify on when a user should specify a cache vs cache policy. Right now, implementation suggests: cache policy on a node/task, cache on an entrypoint/graph. Wondering if it makes sense to make this even more configurable - would you want different types of caches on different nodes?

### @sydney-runkle
> Maybe we could use a more structured dataclass for this eventually? Seems like a pretty internal refactor so low prio but could clean things up

### @hinthornw
> Could be nice to allow `None` for all since there isn't a `list` method to iterate over all keys

### @hinthornw
> Cap depth?

### @hinthornw
> What about if obj has `afunc` defined but not `func`

### @hinthornw
> maybe debug log at least here?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
