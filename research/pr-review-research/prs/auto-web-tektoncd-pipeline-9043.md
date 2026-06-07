# tektoncd/pipeline #9043 — feat(metrics): Migrate from OpenCensus to OpenTelemetry

**[View PR on GitHub](https://github.com/tektoncd/pipeline/pull/9043)**

| | |
|---|---|
| **Author** | @khrm |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @waveywaves
> I have flagged some issues in the pipelinerunmetrics, but the same concerns need to be resolved in the taskrunmetrics as well.

### @waveywaves
> Since these run inside OTel RegisterCallback (fired on every Prometheus scrape), this blocks all concurrent DurationAndCount() calls from the reconciler.

### @waveywaves
> observeRunningTaskRuns uses !tr.IsDone() while the equivalent observeRunningPipelineRuns correctly uses GetCondition(apis.ConditionSucceeded).IsUnknown().

### @waveywaves
> With thousands of PipelineRuns, the list + iteration + attribute map building under lock can exceed Prometheus scrape timeout (default 10s).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
