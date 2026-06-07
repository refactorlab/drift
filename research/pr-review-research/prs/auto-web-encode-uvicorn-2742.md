# encode/uvicorn #2742 — explicitly start ASGI run with empty context

**[View PR on GitHub](https://github.com/encode/uvicorn/pull/2742)**

| | |
|---|---|
| **Author** | @pmeier |
| **Status** | Merged (later reverted) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Kludex
> Currently, the lifespan is a sibling task, but that's not the case in Hypercorn. It may be the case in the future that we refactor the server to make the lifespan task a parent of the whole process instead of a sibling task. Which means that the context would need to come from there.

### @Kludex
> I would like to remove this test when 3.15 reaches EOF, given it's the event loop's job to make sure this is the case. Can we have a mark to not run this on >=3.15?

### @marctc
> We hook `context_run`... When that same request makes an outgoing HTTP call, we look up the current context pointer to find the parent trace and link the spans together... After 0.39, with `contextvars.Context().run(...)`, each request gets a brand new empty context.

### @Kludex
> We can also make this fix only for `asyncio`, and leave uvloop out of it, since it's what people will use in production.

### @tubarao312
> This fix has actually broken some metaprogramming features I was relying on - I was accessing a single variable for multiple uvicorn apps in my monorepo and then changing the variable depending on the context it was in.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
