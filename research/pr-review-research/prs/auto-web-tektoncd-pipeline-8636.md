# tektoncd/pipeline #8636 — feat: override task timeouts in pipelineruns

**[View PR on GitHub](https://github.com/tektoncd/pipeline/pull/8636)**

| | |
|---|---|
| **Author** | @waveywaves |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aThorp96
> One documentation suggestion to clarify the timeout assignment vs timeout enforcement behavior between TaskRuns and PipelineRuns.

### @twoGiants
> I have found temporal coupling in the code...it just needs some minor changes for a quick solution so it can be merged.

### @twoGiants
> Suggested replacing accumulated error handling with direct return statement for cleaner timeout validation logic.

### @twoGiants
> The tests are very good. Thank you for the documentation update, it clarifies a lot.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
