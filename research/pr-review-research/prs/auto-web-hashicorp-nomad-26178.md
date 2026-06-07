# hashicorp/nomad #26178 — Add nomad monitor export command

**[View PR on GitHub](https://github.com/hashicorp/nomad/pull/26178)**

| | |
|---|---|
| **Author** | @tehut |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tgross
> This whole project really points to a need to revisit some of the plumbing for how uni-directional and bi-directional streaming is designed, as it was super painful to add a new endpoint.

### @tgross
> I've also checked this out locally and ran it against a multinode cluster to check things like goroutine leaks, truncated reads, etc. and it looks great!

### @tgross
> This is also unused, looks like. The callers are in other packages, so they can't see this field anyways. But we're not using it in test either.

### @tehut
> I wanted to try it as an exported field...it seems like a dial folks might want to use down the road? Or does that just introduce another thing to keep track of/test/validate?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
