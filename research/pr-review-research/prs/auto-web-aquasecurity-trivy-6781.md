# aquasecurity/trivy #6781 — ci: automate backporting process

**[View PR on GitHub](https://github.com/aquasecurity/trivy/pull/6781)**

| | |
|---|---|
| **Author** | @knqyf263 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @simar7
> Is the prefix for the PR `backport-to-v0.51` or `v0.51` as the example shows?

### @DmitriyLewen
> Is it possible to add options to return error for internal `sorenlouv/backport-github-action` errors?

### @DmitriyLewen
> can we automatically delete the `backport/release/<tag>/pr-<pr-number>` branches after merge backport PR?

### @DmitriyLewen
> After testing, `commitConflicts: true` includes conflicts in code rather than returning errors. Let's gain experience with this before considering a custom backport tool.

### @DmitriyLewen
> looks good 👍

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
