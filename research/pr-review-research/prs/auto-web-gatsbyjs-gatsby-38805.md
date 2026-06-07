# gatsbyjs/gatsby #38805 — perf(gatsby): add a way to skip tracking inline objects

**[View PR on GitHub](https://github.com/gatsbyjs/gatsby/pull/38805)**

| | |
|---|---|
| **Author** | @axe312ger |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pieh
> We don't really have good types for schema customization - most of it is ... `any` 🙈 so this is fine

### @pieh
> we probably shouldn't use `dontX` in internal field names...when talking about raw nodes - we probably should just say `trackInlineObjects: false`

### @pieh
> This will need to be updated before the release once it's clear that Gatsby Version that will contain the addition.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
