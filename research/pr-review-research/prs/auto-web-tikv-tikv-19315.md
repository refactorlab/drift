# tikv/tikv #19315 — BR: add new storage type using google offical rust package

**[View PR on GitHub](https://github.com/tikv/tikv/pull/19315)**

| | |
|---|---|
| **Author** | @JoyC-dev |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @v01dstar
> Why do we need to keep both versions? Are they incompatible? or anything has specific dependency over the older version?

### @JoyC-dev
> For worst case consider: if something wrong happened on new gcsv2, we can work around. For use case: There only some customers needs WIF feature old one can't meet their requiement, but the rest may not need WIF, so old gcp-tame SDK has already work well for them.

### @YuJuncen
> Why rename it? It is really weird and error-prone to mix pascal_case and kebab-case.

### @coderabbitai (bot, but a substantive design concern)
> Avoid loading the entire upload into memory. Line 431–435 reads the full payload into a Vec, which can OOM on large backups and multiplies cost on retries.

### @coderabbitai (bot, but a substantive design concern)
> Missing retry logic for list_objects call. Unlike put, get, and delete operations which use retry_ext for transient error handling, the list_objects call has no retry wrapper.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
