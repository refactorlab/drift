# hyperium/tonic #2320 — feat(grpc): Add `protobuf` codegen

**[View PR on GitHub](https://github.com/hyperium/tonic/pull/2320)**

| | |
|---|---|
| **Author** | @arjan-bal |
| **Status** | Merged (by dfawley on Jul 30, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

> Note: github.com/hyperium/tonic resolves to grpc/grpc-rust (the project was donated to the gRPC org). This is a current PR in that repository.

## Top review comments (most substantive, verbatim)

### @LucioFranco
> absolute paths is what solved it for me

### @LucioFranco
> We can merge this but I want to merge #2321 first and then rebase this ontop of that before we merge this.

### Cross-repository coordination (reviewer discussion)
> (On the `DEP_UPB_VERSION` check in the protobuf crate) it was "not strictly necessary" and caused issues when Tonic wanted to re-export the protobuf crate from tonic-protobuf.

### Implementation scope (PR description / discussion)
> It will be changed when the gRPC API design is finalized and the channel implementation is complete.

### Testing strategy (discussion)
> Interop tests that use the new client codgen running against a Go server (used for integration validation, with plugin binaries cached to maintain CI performance).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
