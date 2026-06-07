# cypress-io/cypress #30770 — breaking: no longer inject document.domain by default

**[View PR on GitHub](https://github.com/cypress-io/cypress/pull/30770)**

| | |
|---|---|
| **Author** | @cacieprins |
| **Status** | Merged (January 6, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ryanthemanuel
> So has this stack essentially been de-sourcemapped? Is that something that we discussed, I can't remember.

### @cacieprins
> Not really - it's still sourcemapped. Because we're no longer injecting `document.domain` setters, chrome has looser security concerns when resolving the stack.

### @AtofStryker
> There needs to be some cleanup with the `experimentalSkipDomainInjection` config value, but @cacieprins is going to handle that in a follow up PR since this is already fairly large.

---

*Note: This breaking-change PR had a focused but smaller set of human review threads on the rendered page; the most substantive exchanges (source-map behavior and the `experimentalSkipDomainInjection` follow-up cleanup) are quoted verbatim above.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
