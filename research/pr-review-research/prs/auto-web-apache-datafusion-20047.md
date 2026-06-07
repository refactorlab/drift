# apache/datafusion #20047 — Add a memory bound FileStatisticsCache for the Listing Table

**[View PR on GitHub](https://github.com/apache/datafusion/pull/20047)**

| | |
|---|---|
| **Author** | @mkleen |
| **Status** | Merged (May 18, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @martin-g
> This won't be accurate... The only solution I imagine is the caller to keep track of the pointer addresses which have been 'sized' and ignore any Arc's which point to an address which has been 'sized' earlier.

### @alamb
> I want to see if some of these slowdowns are reproduced

### @mkleen
> I took this implementation from [arrow-rs]. I would suggest to also do a follow-up here. We are planing anyway to restructure the whole heap size estimation.

### @alamb
> Thanks for pushing this one through @mkleen -- very impressive

### @kosiew
> Thanks for the iteration. Looks 👍 to me

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
