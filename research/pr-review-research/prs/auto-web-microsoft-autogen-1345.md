# microsoft/autogen #1345 — Custom Model Client support

**[View PR on GitHub](https://github.com/microsoft/autogen/pull/1345)**

| | |
|---|---|
| **Author** | @olgavrou |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sonichi
> Looks good. I think a few places in the doc website need to be updated. They can be done in a separate PR

### @davorrunje
> Overall, this is great! I have a few stylistic suggestions to make it a bit more pythonic.

### @davorrunje
> I fixed the failing tests by introducing an additional protocol `AssistantModelClient` extending `ModelClient` with two new properties required for GPT assistants to work.

### @sonichi
> All the tests are passed except GPTAssistantAgent

### @ekzhu
> _(Left multiple inline comments requesting clarifications on error handling, type hints, and API design patterns in the client protocol implementation. Exact per-line prose was not fully retrievable from the web conversation page.)_

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
