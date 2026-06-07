# redpanda-data/redpanda #27039 — cluster_link: admin api definition

**[View PR on GitHub](https://github.com/redpanda-data/redpanda/pull/27039)**

| | |
|---|---|
| **Author** | @michael-redpanda |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

No human reviewer prose could be extracted verbatim. This PR (168 comments) is dominated by automated Copilot AI review threads, and the human review/conversation threads consistently failed to load in the public GitHub HTML ("Failed to load comments. Retry."). Approvals are visible from @chrisseto and @weeco, but without quotable reasoning text.

From the PR description and commits, the review-driven design changes included replacing `key_set` with `key_fingerprint` and renaming `ClusterLink` to `ShadowLink` (the merged service is exposed as a `shadow_link` RPC service). The original reviewer comments advocating these changes were not retrievable without an API token.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
