# openai/openai-python #2588 — feat(client): support callable api_key

**[View PR on GitHub](https://github.com/openai/openai-python/pull/2588)**

| | |
|---|---|
| **Author** | @johanste |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @RobertCraigie
> This feels like it could be brittle and cause some weird behaviour if we access `self.api_key` in multiple places for the same request. My gut is that we could just not support callable api keys for the module client?

### @kristapratico
> Discussed with @johanste offline and agreed we can remove callable api keys for the module level client.

### @RobertCraigie
> Looks great thank you!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
