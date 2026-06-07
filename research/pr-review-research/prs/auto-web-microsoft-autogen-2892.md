# microsoft/autogen #2892 — Mistral Client

**[View PR on GitHub](https://github.com/microsoft/autogen/pull/2892)**

| | |
|---|---|
| **Author** | @marklysze |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Josephrp
> would be nice to make a toy notebook or app in examples and a short blog post about it, to accompany the next release

### @Hk669
> _(Suggested users install Mistral manually rather than adding it to core dependencies, following the non-OpenAI models pattern documented in the project guidelines.)_

### @scruffynerf
> you have some assumptions that content is empty if tool_call responses exist. While usually true, not always true...might not be true for Mistral, but if OpenAI supports it, should allow for them to maybe allow it too

### @yiranwu0
> _(Advised mocking only the specific Mistral API call line rather than broader mocking, allowing the rest of the create function logic to execute during testing.)_

### @qingyun-wu
> _(Removed unnecessary try-catch around the API call since catching and re-throwing errors adds no value.)_

### @scruffynerf
> _(Flagged that tests shouldn't assume message content is empty or that tool calls appear at index zero, as multiple tools and concurrent content are possible.)_

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
