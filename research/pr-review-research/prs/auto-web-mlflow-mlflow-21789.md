# mlflow/mlflow #21789 — Add `BatchSpanProcessor` option to decouple trace export from request path

**[View PR on GitHub](https://github.com/mlflow/mlflow/pull/21789)**

| | |
|---|---|
| **Author** | @PattaraS |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @B-Step62
> I would suggest ramping up this behavior along with async logging flag because the behavior is kind coupled. If either of two flag is enabled, trace logging becomes async, so having different default value would be confusing.

### @TomeHirata
> Is it risky to enable batching by default like DatabricksUCTableSpanExporter?

### @B-Step62
> Can we create a utility function like `get_batch_delegate_processor()` that checks these env var settings so we don't need to pass these configs around?

### @TomeHirata
> We already have `MLFLOW_ASYNC_TRACE_LOGGING_MAX_SPAN_BATCH_SIZE`

### Copilot AI (automated review)
> After the Phase 2 retry loop, the code assumes every `trace_id` exists in `existing_traces`... If repeated `IntegrityError` rollbacks prevent a trace from being created, this will raise a `KeyError` and drop the whole OTLP batch.

### Copilot AI (automated review)
> The fixed `time.sleep(0.2)` makes this E2E test timing-dependent and likely flaky on slower CI or under load. Instead of sleeping, poll for the expected trace/spans...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
