# tikv/tikv #18173 — follower read cache

**[View PR on GitHub](https://github.com/tikv/tikv/pull/18173)**

| | |
|---|---|
| **Author** | @mittalrishabh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cfzjywxk
> The V2 is no longer maintained, so there is no need to implement on it.

### @glorv
> user u64 directly (rather than var_u64 for timestamp encoding, since constant field sizes eliminate the need for length prefixes)

### @mittalrishabh
> i would prefer to decode from bytes instead of simply assuming that it is u64

### @cfzjywxk
> (suggested moving the lock-check histogram observation) to the end of the whole region range memory lock check which could take more time.

### @mittalrishabh
> it needs a new metric. I can not reuse the same one. Can i add it in follow up PR

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
