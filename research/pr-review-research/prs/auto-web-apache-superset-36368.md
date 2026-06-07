# apache/superset #36368 — feat: add global task framework

**[View PR on GitHub](https://github.com/apache/superset/pull/36368)**

| | |
|---|---|
| **Author** | @villebro |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aminghadersohi
> the whole pitch of GTF is getting long-running work off web workers, but when a sync caller hits a deduplicated task, join-and-wait blocks the web worker polling until the async task completes doing zero useful work.

### @aminghadersohi
> the @task decorator checks is_feature_enabled at import time, not at call/schedule time. So if any module with @task-decorated functions gets imported during app startup...the app just crashes.

### @michael-s-molina
Recommended changing noisy info logs to debug level to reduce message volume when many tasks are entered, and requested an efficiency improvement on the status endpoint — to "do a targeted select on the `status` column only to avoid pulling in the entire task object."

### @mistercrunch
Advocated for unified execution paths so "all tasks go through the same general codepaths/decorators/abstractions," suggesting a `@global_task_framework(mode="legacy")` decorator to enable gradual migration.

### @kgabryje
Recommended displaying "an error toast instead of failing silently" when copy-to-clipboard operations fail.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
