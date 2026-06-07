# grpc/grpc-go #7857 — internal/resolver: introduce a new delegating resolver to handle both target URI and proxy address resolution

**[View PR on GitHub](https://github.com/grpc/grpc-go/pull/7857)**

| | |
|---|---|
| **Author** | @eshitachandwani |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dfawley
> Consider removing these and using `nil` for `targetResolverState` and `nil` for `proxyAddrs` to indicate that the state/addresses are 'valid'. Having two different pieces of state that represent parts of the same thing should be avoided.

### @arjan-bal
> Not actionable: This is essentially the same as using `passthrough` as the target resolver. If we need to avoid sending the dial option to the delegating resolver, the channel could send `passthrough` as the target resolver to get the same effect.

### @dfawley
> FYI, empty structs are allocated specially, so if it's an empty struct it will not save memory to have a global instance of it.

### @arjan-bal
> Please move this down to where you commented about it

### @arjan-bal
> nit: Space missing after `//`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
