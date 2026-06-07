# cloudflare/workerd #5014 — Streams cleanups... new adapters

**[View PR on GitHub](https://github.com/cloudflare/workerd/pull/5014)**

| | |
|---|---|
| **Author** | @jasnell |
| **Status** | Merged (October 1, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @harrishancock
> the minread support likely needs to be configurable. Right now it will attempt to fill the buffer entirely, but that might lead to increased latency if the read isn't fulfilled quickly.

### @harrishancock
> (Requested clarification on exception safety and resource cleanup in adapter destruction paths across multiple review rounds.)

### @harrishancock
> (Emphasized the importance of verifying the checked Queue properly prevents use-after-free and reference invalidation issues in buffering operations.)

### @erikcorry
> (Provided approval with minor observations regarding implementation consistency across the four adapter classes and test coverage completeness.)

### @jasnell
> (Author response — implemented a minimum read policy with IMMEDIATE and OPPORTUNISTIC modes to address latency concerns while balancing buffer-filling efficiency.)

---
*Note: Several comments above are paraphrased by the web extractor rather than fully verbatim; see the PR page for exact wording.*

*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
