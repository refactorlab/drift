# cloudflare/workerd #4591 — implement node:http server-side modules

**[View PR on GitHub](https://github.com/cloudflare/workerd/pull/4591)**

| | |
|---|---|
| **Author** | @anonrig |
| **Status** | Merged (July 29, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jasnell
> The server API should be gated behind an experimental compat flag that is separate from the one used to enable the http client APIs so we can roll those out separately.

### @jasnell
> The way it's structured I think there's far too much internal buffering of the data as opposed to streaming it out as it is written.

### @jasnell
> Before this comes out of experimental, I'd really like to see the remaining todos addressed as well as seeing the test coverage expanded.

### @guybedford
> Specifically - if this will be supported, then a TODO comment somewhere

### @jasnell
> If you plan on keeping the unrelated-to-http `globalThis.Cloudflare` changes in this PR then I'd just ask that you make sure those are in a separate commit.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
