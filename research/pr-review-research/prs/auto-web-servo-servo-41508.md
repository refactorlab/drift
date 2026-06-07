# servo/servo #41508 — Indexeddb: transaction lifecycle

**[View PR on GitHub](https://github.com/servo/servo/pull/41508)**

| | |
|---|---|
| **Author** | @Taym95 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gterzian
> When a transaction is created, it is set to active. Then at the next microtask it is set to inactive. However, for each even that fires after that for a request, it is set back to active.

### @gterzian
> The concept of 'starting' a transaction I think is mostly a backend thing, even though the spec queues a task for it.

### @gterzian
> I think this is just Step 8: Set transaction's cleanup event loop to the current event loop of https://w3c.github.io/IndexedDB/#dom-idbdatabase-transaction

### @gterzian
> I added some comments here and there about structural improvements. Mostly about doing something via a round-trip with the backend as oppposed to directly in script.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
