# pgvector/pgvector #682 — Update HNSW cost estimatation to utilize search and index info

**[View PR on GitHub](https://github.com/pgvector/pgvector/pull/682)**

| | |
|---|---|
| **Author** | @jkatz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ankane
> Removing this should fix the test. I don't think this type of selectivity is what the planner expects.

### @ankane
> I think it'd be better to keep the previous naming (`entryLevel`) here since it's really the total number of layers - 1, as well as `HnswGetMl(m)`.

### @ankane
> I think `HnswSF` should be included in `layer0Selectivity` to make the `layer0Selectivity` description accurate.

### @ankane
> Let's use the prefix `HNSW_COST` ... I'd prefer to keep this in `hnswcostestimate`

### @ankane
> I think the + 1 approach would be slightly better since the index can fulfill the query (the first path is more designed to prevent something the index can't do).

### @ankane
> It only saves a `* 1` which the compiler likely removes, but I think it's more correct. If `ml` changes, we would need to change this.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
