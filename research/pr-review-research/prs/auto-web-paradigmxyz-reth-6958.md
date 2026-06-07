# paradigmxyz/reth #6958 — feat(prune): timeout

**[View PR on GitHub](https://github.com/paradigmxyz/reth/pull/6958)**

| | |
|---|---|
| **Author** | @emhane |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @shekhirin
> I like the `PruneLimit` struct, it's the right direction. We want it to control when to stop **one** `Pruner` run based on both: 1. Number of entries deleted from the database (total, from all segments) 2. Time spent running (again, for all segments, and to be more precise for the whole `Pruner::run`)

### @shekhirin
> we do account/storage history pruning in two steps: 1. Prune the changesets and memorize the highest pruned block 2. Prune indices up to the highest pruned block from changesets. Given that, we can't stop step 2 if time limit is reached, because then we'll have inconsistent data in the database

### @shekhirin
> It needs to be solved separately because not obvious yet how to do that and the PR is already quite large

### @joshieDo
> lgtm, but would feel more confortable if it was run for some time if it hasn't already

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
