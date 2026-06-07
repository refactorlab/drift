# argoproj/argo-cd #18646 — feat: oci support (Beta)

**[View PR on GitHub](https://github.com/argoproj/argo-cd/pull/18646)**

| | |
|---|---|
| **Author** | @blakepettersson |
| **Status** | Merged (June 6, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ishitasequeira
> The overall code on the PR looks good so far. This is an amazing start to the feature...One thing we might need to look into is how can we reduce the number of calls to OCI repositories...Something what we already do for git ls-remote calls. But this can be a future enhancement.

### @ishitasequeira
Flagged potential performance issues with repeated OCI repository calls and suggested implementing caching mechanisms similar to existing git operations as a follow-up enhancement.

### @Wwwsylvia
Provided iterative feedback on the OCI client implementation across several review rounds, focusing on code correctness in `util/oci/client.go`.

### @keithchong
Reviewed changes to user-facing components including the repositories list and revision metadata panel, ensuring proper integration of OCI support into the application interface.

### @crenshaw-dev
Collaborated on final implementation details before the merge was completed for the v3.1 release milestone.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
