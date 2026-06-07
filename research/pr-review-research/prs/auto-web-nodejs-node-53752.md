# nodejs/node #53752 — lib,src,test,doc: add node:sqlite module

**[View PR on GitHub](https://github.com/nodejs/node/pull/53752)**

| | |
|---|---|
| **Author** | @cjihrig |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Qard
> Should we be concerned at all about the performance impact of people using these sync APIs within requests and blocking the event loop? With sync being the _only_ option here I feel like the risk is increased.

### @Qard
> If the concern is simplicity, I feel like only async would be better than only sync. Especially given top-level await. What reason is there to favour sync over async here?

### @benjamingr
> SQLite runs in process and is often CPU bound, we do have async APIs for some CPU intensive stuff (like in crypto) but I suspect for most people this API is the better one performance wise

### @benjamingr
> It would be nifty to also support Symbol.dispose here but that can be in a follow up PR.

### @avivkeller
> This is adding a new feature, so shouldn't be semver-minor? (and with this kind of change, `notable-change` as well?)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
