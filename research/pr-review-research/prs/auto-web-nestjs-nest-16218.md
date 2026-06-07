# nestjs/nest #16218 — feat(microservices): add redis driver identification

**[View PR on GitHub](https://github.com/nestjs/nest/pull/16218)**

| | |
|---|---|
| **Author** | @vchomakov |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

All substantive feedback came from maintainer @kamilmysliwiec, pushing back on auto-detection in favor of explicit, opt-in configuration.

### @kamilmysliwiec
> Instead of auto-retrieving the @nestjs/microservices packagae version, we could just add the `clientInfoTag` configuration attribute so users can specify them (manually, if needed) in the strategy options object.

### @kamilmysliwiec
> Can we please remove this (as suggested in the previous PR)? No need to auto-set it for everyone

### @kamilmysliwiec
> the current default (node-redis) seems fine though, what's the reason for adding the (nestsjs) suffix there? even if you have multiple nestjs services, you'd end up with duplicated tags.

### @kamilmysliwiec
> Could you please update it as suggested above, otherwise i won't be able to merge this PR

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
