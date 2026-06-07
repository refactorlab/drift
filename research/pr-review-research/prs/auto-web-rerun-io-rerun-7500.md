# rerun-io/rerun #7500 — Implement graph components and archetypes

**[View PR on GitHub](https://github.com/rerun-io/rerun/pull/7500)**

| | |
|---|---|
| **Author** | @grtlr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nikolausWest
> In this design, are the node id's global?

### @nikolausWest
> I'm rather thinking about what happens if a user has multiple graphs...edges started going between them

### @Wumpf
> changes the query mechanism from going through a higher level abstraction to direct store queries...blueprint can't be applied

### @nikolausWest
> Perhaps some kind of greyed out nodes could make sense there (maybe even an option to include or exclude those)

### @grtlr
> Edges now have two additional attributes `source_entity` and `target_entity`...Allow linking between nodes of different entities

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
