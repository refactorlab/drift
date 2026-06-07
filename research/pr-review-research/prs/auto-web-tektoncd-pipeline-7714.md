# tektoncd/pipeline #7714 — Surface artifacts through termination message

**[View PR on GitHub](https://github.com/tektoncd/pipeline/pull/7714)**

| | |
|---|---|
| **Author** | @ericzzzzzzz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @afrittoli
> According to the coverage report, this section is not well covered by unit tests, but we have E2E coverage for this, so it should be fine.

### @afrittoli
> NIT: in all other error cases, we have a `logger.Errorf` message, should we have one here too?

### @ericzzzzzzz
> Do I need to include some md files for this feature at the moment? Do I need to include some examples to show how to write/consume artifacts provenance data

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
