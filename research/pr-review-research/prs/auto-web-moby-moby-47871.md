# moby/moby #47871 — Portmapper improvements, and options to disable NAT

**[View PR on GitHub](https://github.com/moby/moby/pull/47871)**

| | |
|---|---|
| **Author** | @robmry |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @akerouanton
> Why remove this?

### @akerouanton
> Since IPv4-mapped IPv6 addrs aren't properly unmapped, I think this condition doesn't hold true.

### @corhere
> Have you considered converting the implementation to use `net/netip` types internally?

### @akerouanton
> Maybe we should consider dropping this compatibility code after a few releases.

### @corhere
> It looks a lot like `n.driver` is guaranteed to be non-nil and immutable.

### @corhere
> Oh, that's contrived! Better use an arg that clearly states what address family should be restored.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
