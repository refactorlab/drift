# meilisearch/meilisearch #5254 — Granular Filterable attribute settings

**[View PR on GitHub](https://github.com/meilisearch/meilisearch/pull/5254)**

| | |
|---|---|
| **Author** | @ManyTheFish |
| **Status** | Merged (March 12, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dureuill
> A major feature, well designed, tested and documented. Thank you for your tremendous work 🚀

### @dureuill
> Please fix clippy errors

Note: Several additional substantive review threads from @dureuill were inline code-line comments (clarifying `metadata_for_field`'s reliance on user-provided vs enriched data during field matching; questioning the facet-distribution logic for whether fields can be faceted via `FieldIdMapWithMetadata`; and concerns about document-change selector closures being applied correctly during field extraction). These were implementation-detail reviews resolved after clarification; final approval was granted.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
