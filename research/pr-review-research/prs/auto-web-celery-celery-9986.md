# celery/celery #9986 — Fix: Broker heartbeats not sent during graceful shutdown

**[View PR on GitHub](https://github.com/celery/celery/pull/9986)**

| | |
|---|---|
| **Author** | @weetster |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @auvipy
> can you also check the possibility of adding integration tests for this change?

### @weetster
> I verified that the integration test will fail with a `ConnectionResetError` on the `main` branch, which confirms the test captures the behaviour of the bug.

### @weetster
> I uncovered a bug in `billiard` where the result handler thread gets terminated before allowing tasks to complete and send their results back.

### @auvipy
> I will merged the billiard fix first.

### @auvipy
> you are welcome. it would be great if you can follow up in case of any report of regression raise later.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
