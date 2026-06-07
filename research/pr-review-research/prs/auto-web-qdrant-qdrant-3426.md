# qdrant/qdrant #3426 — Assign clock tags to internal update operations (and update operation responses)

**[View PR on GitHub](https://github.com/qdrant/qdrant/pull/3426)**

| | |
|---|---|
| **Author** | @generall |
| **Status** | Merged (Feb 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @timvisee
> Shall we define type names, like `PeerId`?

(Requesting type aliases for clarity around `u32` and `u64` clock identifiers.)

### @ffuugoo
> I have another question: do we want additional safeguard around tick `0`?... We could add some special handling around `0`, but it will probably be rather ugly.

### @ffuugoo
> `tick_once` only increment `next_tick` if it is already more than `0`. If `next_tick` is `0` we keep returning `0` and don't increment `next_tick`.

### @timvisee
> To answer this, always advance for now so we don't get operations with duplicate clock tags... we can discuss this corner case and how to reject operations later.

### @ffuugoo
> should we only call `advance_to` if at least `minimal_success_count` replicas returned successful response or if `local_shard` is present...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
