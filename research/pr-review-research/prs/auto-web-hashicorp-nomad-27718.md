# hashicorp/nomad #27718 — acl: downscope `AllowClientOp` to node pool

**[View PR on GitHub](https://github.com/hashicorp/nomad/pull/27718)**

| | |
|---|---|
| **Author** | @pkazmierczak |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tgross
> For RPCs, my expectation is that we should check the caller node pool _and_ the target resource node pool, too, correct?

### @tgross
> I think we've introduced an authentication race for disconnected nodes that have been GC'd...maybe we should fail closed via `AuthorizeSameNode` anyways just so we don't have to explain this to an auditor later

### @tgross
> Now you see why I did a spike on RPC middleware so we could get all these in order every time. It... wasn't successful because Go generics are pretty rough.

### @allisonlarson
> This LGTM, I left some questions to satisfy my curiosity but I don't think they need to block.

### @tgross
> LGTM! This was a slog, thanks for sticking with it!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
