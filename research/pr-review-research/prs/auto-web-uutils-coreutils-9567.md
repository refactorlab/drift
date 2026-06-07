# uutils/coreutils #9567 — build-gnu.sh: Use MULTICALL=y and skip not used utils for faster build

**[View PR on GitHub](https://github.com/uutils/coreutils/pull/9567)**

| | |
|---|---|
| **Author** | @oech3 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: This PR's conversation rendered mostly as CI/bot output (github-actions,
> codspeed-hq), and the inline review-thread prose did not load over two fetch
> attempts. The reviewer of record was **@pixelb** ("pixelb left review comments");
> the only reliably-loaded human prose was procedural/troubleshooting from the author
> **@oech3**, captured verbatim below.

### @oech3
> No idea about multicall specific `seq` bug... So I made it individual

### @oech3
> I was confised by `nproc` things. But this PR is ready now

### @oech3
> @sylvestre Would you merge this now? Rebasing every PR without reducing build time is bit pain

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
