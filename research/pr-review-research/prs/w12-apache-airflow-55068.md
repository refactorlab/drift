# apache/airflow #55068 — Re-enable start_from_trigger feature with template rendering

**[View PR on GitHub](https://github.com/apache/airflow/pull/55068)**

| | |
|---|---|
| **Author** | @dabla |
| **Status** | ✅ merged (2026-03-25) · 🚀5 |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Explain the architectural invariant (the triggerer can't load DAG code), then *measure* the hot-path cost it introduces and propose the cheap guard (a boolean flag to skip the load).

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@ashb:**
> Dag bundles are not initialized in the triggerer... This is because the triggerer does not deal with changes in trigger code over time, as everything happens in the main process.

**@kaxil:**
> get_serialized_dag_model() and subsequent deserialization runs for every trigger... Most triggers don't use start_from_trigger, so this adds unnecessary DB and CPU overhead.

**@kaxil:**
> Consider adding a lightweight indicator (e.g., a boolean flag on the Trigger model or TI) so you can skip the DAG load entirely when start_from_trigger isn't in play.

**@dabla:**
> Even if template rendering would be reusable... you will still need the context... you need at least a RuntimeTaskInstance, which requires a task.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
