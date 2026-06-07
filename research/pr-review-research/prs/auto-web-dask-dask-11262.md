# dask/dask #11262 — Implement task-based array shuffle

**[View PR on GitHub](https://github.com/dask/dask/pull/11262)**

| | |
|---|---|
| **Author** | @phofl |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fjetter
> I assume this is pretty much equivalent to `arr.take(...).rechunk(arr.chunks)` isn't it?

### @mrocklin
> Let's imagine a pathological case where we have two chunks and and indexer that switches back and forth between them... Optimally we should be able to do this in around 6 tasks I think, assuming we're willing to do the take in a couple of stages, in worst case we'll do it in 200,000 tasks.

### @dcherian
> This behaviour is problematic for... resample... The chunks will become too large

### @dcherian
> I feel like its preferrable to do this and then have the user do the rechunk-to-one-block-while-adjusting-others.

### @hendrikmakait
> Should we test different tolerances?

### @phofl
> Just to align expectations: This is still pretty bad, less bad than before, but far away from actually being good

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
