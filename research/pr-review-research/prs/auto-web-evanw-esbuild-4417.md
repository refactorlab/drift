# evanw/esbuild #4417 — fix: Handle non-awaited async generator

**[View PR on GitHub](https://github.com/evanw/esbuild/pull/4417)**

| | |
|---|---|
| **Author** | @2767mr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @evanw
> Thanks for the PR. Really appreciate you adding all of these tests. I see how the queue works and I think this approach makes sense, as TypeScript's `__asyncGenerator` helper function also uses a queue. I don't have this loaded in my head right now but I think moving forward is reasonable given the test coverage, the simplicity of the change, and the similarity to TypeScript's approach.

---

*Note: This PR had limited human review discussion on the rendered conversation page — the substantive technical exchange visible was the single maintainer (@evanw) acceptance comment quoted above, which explains the reasoning (queue approach mirroring TypeScript's `__asyncGenerator`, justified by test coverage and simplicity).*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
