# delta-io/delta #6166 — [Delta-Spark] Extend stagingCatalog for non-Spark session catalog

**[View PR on GitHub](https://github.com/delta-io/delta/pull/6166)**

| | |
|---|---|
| **Author** | @TimothyW553 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tdas
> getExistingTableFromDelegatedCatalog adds an extra UC server round-trip on every CREATE TABLE (not just replace). Should be gated on replace operations only.

### @tdas
> catalogManagedReplacePreservesMetadata returning true triggers an early return in replaceMetadataIfNecessary, silently skipping all metadata updates. Fragile if future code is added after the return site.

### @murali-db
> updateMetadataInternal is called before the UC guard. This means internal newMetadata state is mutated even when the metadata change would be rejected by the guard.

### @xzhseh
> Can we avoid default value and enforce every callsite to provide identOpt and operation? [Also:] functional style here flatMap hides the semantics and is NOT obvious to the readers.

### @xzhseh
> Please document getExistingTableFromDelegatedCatalog as well. [Also:] let's document why this would be V1 table instead of V2 even after going through UC.

### @huan233usc
> Not sure if same schema + different cluster key work or not. Plz double check. Also follow up with yili-db to decide if we want to block clustering update

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
