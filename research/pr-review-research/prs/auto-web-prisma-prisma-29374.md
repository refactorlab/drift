# prisma/prisma #29374 — feat(cli): add prisma bootstrap command

**[View PR on GitHub](https://github.com/prisma/prisma/pull/29374)**

| | |
|---|---|
| **Author** | @kristof-siket |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wmadden
> Replace LinkApiError with plain Error for init failures — LinkApiError represents Management API errors, not local init failures

### @wmadden
> Default link step status to 'skipped' instead of 'failed' — matches the pattern used by other steps

### @wmadden
> Replace N+1 resolveProjectForDatabase with single GET /v1/databases/{databaseId} call — O(1) instead of O(projects × databases)

### @wmadden
> Add 5-minute timeout to installDependencies to prevent indefinite hangs

### @wmadden
> Deduplicate schemaHasModels by reusing getModelNames from project-state, removing 12 lines and picking up the IO error guard

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
