# minio/minio #19068 — feat: Add Metrics V3 API

**[View PR on GitHub](https://github.com/minio/minio/pull/19068)**

| | |
|---|---|
| **Author** | @donatello |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @harshavardhana
> since its documented as `/node` thought `/minio` is missing

### @harshavardhana
> Also why does it need to have a feature gate? this is going to be a new endpoint.

### @donatello
> Main reason is to allow for some iteration mainly in the naming of metrics and their endpoints before declaring it stable

### @shtripat
> we need to remove these before merge

### @donatello
> Updated the PR: 1. fix for failing mint tests, 2. remove feature gate.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
