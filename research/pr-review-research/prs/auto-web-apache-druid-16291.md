# apache/druid #16291 — Auto-Compaction using Multi-Stage Query Engine

**[View PR on GitHub](https://github.com/apache/druid/pull/16291)**

| | |
|---|---|
| **Author** | @gargvishesh |
| **Status** | Merged (July 12, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kfaraz
> We need UTs to test the entire flow with MSQ the same way we are doing with native...most Druid devs rely on UTs more heavily as the IT flow is a little flaky currently.

### @kfaraz
> In the current PR, I would prefer it if we didn't modify any of the logic for native compaction...What happens if we just stick to the old logic?

### @kfaraz
> Why are we comparing just the combining factory now and not the original AggregatorFactory itself? Please add comments (and tests, if not already added) to clarity this change.

### @kfaraz
> Please resolve merge conflicts in the PR. It has been introduced by a recent NPE bugfix in #16713.

### @gargvishesh
> The existing tests in CompactionTaskRunTest however cannot be parameterised since MSQ code resides in an extension...tests therefore need to be present in the extension itself.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
