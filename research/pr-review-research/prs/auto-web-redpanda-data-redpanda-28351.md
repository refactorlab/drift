# redpanda-data/redpanda #28351 — lsm: introduce a seastar native LSM database based on LevelDB

**[View PR on GitHub](https://github.com/redpanda-data/redpanda/pull/28351)**

| | |
|---|---|
| **Author** | @rockwotj |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @andrwng
> I like it. I also think it'd be helpful to have a brief comment describing the variant types near the definition, or some high level description of how we stash keys when there are updates

### @andrwng
> nit: probably worth adding similar tests for deleting the head and the last nodes

### @andrwng
> Just thinking about the db::impl but potentially replicated with Raft and using cloud storage, I'm thinking it makes sense to separate out the deterministic state and updates...from the background work, that maybe we'd drive on a leader with some different policies for when to flush.

### @andrwng
> Also it's probably gonna be worth thinking a bit more about how cloud_persistence interacts with the more general cloud cache, if at all. I'm fine with getting this in with raw staging files though.

### @dotnwat
> my browser barely can load this PR with all the comments and i'm not sure i'm getting value out of continuing to pile on more comments and fixups...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
