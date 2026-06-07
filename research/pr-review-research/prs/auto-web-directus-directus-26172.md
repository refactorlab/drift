# directus/directus #26172 — Collaborative Editing Implementation (〃￣︶￣)人(￣︶￣〃)

**[View PR on GitHub](https://github.com/directus/directus/pull/26172)**

| | |
|---|---|
| **Author** | @Nitwel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ComfortablyCoding
> Aside from a few comments, the code changes LGTM

### @ComfortablyCoding (on `sanitize-payload.ts`)
> Comments addressed security of nested payload sanitization and permission verification patterns, requesting refinements to how authorization checks were structured.

### @br41nslug (on `validate-item-access.ts`)
> Flagged concerns about permission validation logic, particularly around how item access controls were integrated into the collaborative system.

### @licitdev (on WebSocket handler files)
> Raised technical concerns about message handling race conditions and distributed state consistency across multi-instance deployments.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
