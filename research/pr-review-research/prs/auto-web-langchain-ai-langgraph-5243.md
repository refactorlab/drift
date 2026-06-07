# langchain-ai/langgraph #5243 — feat(langgraph): new context api (replacing `config['configurable']` and `config_schema`)

**[View PR on GitHub](https://github.com/langchain-ai/langgraph/pull/5243)**

| | |
|---|---|
| **Author** | @sydney-runkle |
| **Status** | Merged (July 15, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @eyurtsev
> def node(state: State, runtime): # <-- does this work without a type annotation? Should it work?

### @sydney-runkle
> Right now, yes. We could be stricter, but I think we should at least support the un-parametrized case (ex, if a dev wants access to store but has no custom `context_schema`).

### @sydney-runkle
> Had to modify these tests to use `__pregel_runtime` in the short term. We'll be deprecating injection of these items in another PR so this will change soon.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
