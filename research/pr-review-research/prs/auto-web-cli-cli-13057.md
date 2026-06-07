# cli/cli #13057 — Add Issues 2.0 support: issue types, sub-issues, and relationships

**[View PR on GitHub](https://github.com/cli/cli/pull/13057)**

| | |
|---|---|
| **Author** | @BagToad |
| **Status** | Merged (June 4, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @camchenry
> For consistency with the other `--add-*` and `--remove-*` options, it might be good to have a `--add-parent` option as well

### @babakks
> `FetchOptions` silently ignores errors from `api.RepoIssueTypes` when...the user has opted into editing the Type

### @babakks
> We also need TTY test cases for type and parent prompts.

### @babakks
> Validate `IssueRelationshipsSupported` up-front when relationship flags are used, before any mutation

### @BagToad
> The fix teaches `FetchOptions` to store a name to ID map on `Editable` (to avoid redundant API calls)

### @babakks
> The `AddBlockedByPayload` types expose the result as 'issue', not 'blockedIssue'

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
