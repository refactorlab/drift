# hyperium/tonic #1670 — Upgrade to Hyper 1.0 & Axum 0.7

**[View PR on GitHub](https://github.com/hyperium/tonic/pull/1670)**

| | |
|---|---|
| **Author** | @alexrudy |
| **Status** | Merged (June 12, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

> Note: hyperium/tonic was donated to the gRPC organization; the canonical home is now grpc/grpc-rust, which is what github.com/hyperium/tonic resolves to. This PR is part of the tonic project history.

## Top review comments (most substantive, verbatim)

### @djc
> Since this is already such a large change, I'd like to avoid intertwining the changes that are necessary to upgrade hyper/axum with any other changes that can be done independently.

### @djc
> I would like to avoid further entangling of Axum and Tonic proper...for client-only users, we should be working in a direction where it's possible to avoid depending on Axum.

### @aumetra
> It would be nice if there were feature flags to switch between the crypto backends. Defaulting to `aws-lc-rs` pulls in a cmake, nasm requirement, impacts platform support...

### @LucioFranco
> This is probably the biggest refactor that tonic has seen and I appreciate the patience...There is a `v0.11.x` branch that will keep support for hyper v0.14.

### @alexrudy
> (Defended the PR scope against modularity critiques, explaining that compatibility requirements with both pre- and post-1.0 hyper versions would add complexity if split across multiple PRs.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
