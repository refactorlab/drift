# paradigmxyz/reth #18882 — feat: add StaticFileSegment::AccountChangeSets

**[View PR on GitHub](https://github.com/paradigmxyz/reth/pull/18882)**

| | |
|---|---|
| **Author** | @Rjected |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @joshieDo
> we might want to try this one with `lz4`

### @joshieDo
> is it possible to move this logic by impl `AccountExtReader` for `StaticFileProvider` similarly to the others?

### @shekhirin
> this makes the segment header size dynamic, is it ok?

### @mattsse
> reading and writing logic, especially bounds checks, are always very complex, so perhaps we could add a few more helpful docs here and there

### @joshieDo
> maybe very edge case, but if the genesis has no state changes, i guess we'd never actually initialize the segment

### @shekhirin
> would be nice for `account_changesets_range` to accept an `impl RangeBounds`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
