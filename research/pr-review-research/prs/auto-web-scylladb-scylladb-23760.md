# scylladb/scylladb #23760 — Introduce view building coordinator

**[View PR on GitHub](https://github.com/scylladb/scylladb/pull/23760)**

| | |
|---|---|
| **Author** | @Jadw1 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @piodul
> I'm not super happy that we are exposing those dependencies. I'm also not sure if it makes sense for `storage_proxy` to refer to `view_building_state_machine`...I'd prefer if you changed those functions so that they receive `system_keyspace` and `view_building_state_machine` explicitly, as arguments.

### @piodul
> we didn't flush the views, we only flushed their corresponding base table. The name is confusing, perhaps should be improved in a follow-up.

### @piodul
> In all fairness, I don't see a satisfying way out of this, so if it is too hard to change the current logic then I won't push hard on changing it.

### @Jadw1
> new view is added but table never flushed again, so new view never gets mutations...Fixed by storing `table_id` of views which existed at flush time.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
