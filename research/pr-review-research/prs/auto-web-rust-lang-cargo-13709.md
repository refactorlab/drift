# rust-lang/cargo #13709 — feat: implement RFC 3553 to add SBOM support

**[View PR on GitHub](https://github.com/rust-lang/cargo/pull/13709)**

| | |
|---|---|
| **Author** | @justahero |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @weihanglo
> Now I like the idea of having this PR to explore SBOM format. I'll post back issues we've found so far to the RFC.

### @heisen-li
> It seems appropriate to modify the documentation of the corresponding sections, e.g. Configuration, Environment Variables.

### @weihanglo
> We should probably focus on the design discussion first, as the location of the configuration is not yet decided.

### @arlosi
> The graph is no longer combining dependencies within the same package. This means that things like libs and build scripts within a package get unique nodes in the graph.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
