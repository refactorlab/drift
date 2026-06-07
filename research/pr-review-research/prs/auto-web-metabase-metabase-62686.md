# metabase/metabase #62686 — Remote Sync

**[View PR on GitHub](https://github.com/metabase/metabase/pull/62686)**

| | |
|---|---|
| **Author** | @johnswanson |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @edpaget
> Gotta check dashboard dependencies for the model attached to an action. Potentially make the dependent check a union-all. non-remote-synced-dependencies needs to check links from documents and dashboards too.

### @iethree
> this seems to be causing bugs and test flakes due to unnecesary re-renders

(flagging a change from `_.isEqual(data, prevData)` to `data !== prevData` in Tree.tsx)

### @iethree
> this new prop is never used

### @iethree
> this new function is not used

(noting that the `getAllExpandableIds` utility in tree utils had no callers)

### @metabase-bot
> The optional `user-id` parameter is not used in this function but is part of the signature

(on `create-or-update-remote-sync-object-entry!`)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
