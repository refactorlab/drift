# trinodb/trino #28381 — Read metadata and protocol information from Delta checksum files

**[View PR on GitHub](https://github.com/trinodb/trino/pull/28381)**

| | |
|---|---|
| **Author** | @adam-richardson-openai |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @findinpath
> I eliminated all cases of mocking or writing of synthetic files, in favor of new fixtures generated using Spark

### @findinpath
> The test succeeds also without the productive code changes on EmulatedListFilesStartingFromIterator.java I would have assumed that it was suposed to fail.

### @raunaqmorarka
> Verified by reverting the iterator change locally: the test fails with `IllegalStateException`

### @wendigo
> First commit LGTM

*(regarding the path-normalization fix for ADLS Gen2 filesystem compatibility)*

### @adam-richardson-openai
> I'll put subsequent fixes in their own commits

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
