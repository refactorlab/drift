# minio/minio #20033 — feat: support batch replication prefix slice

**[View PR on GitHub](https://github.com/minio/minio/pull/20033)**

| | |
|---|---|
| **Author** | @jiuker |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @klauspost
> Comma is a valid prefix character. YAML has list/array types, why aren't we using that?

### @harshavardhana
> Bump the version: field so ensure that we use v2 array for prefixes vs version '1' that supports single string.

### @krisis
> We don't gain anything from struct embedding; Let's use separate types with separate fields. We need to handle v1 job request when we resume batch jobs after an upgrade.

### @harshavardhana
> You first unmarshal the `versionStruct` then get the APIVersion once you get the APIVersion choose the right data structure to `unmarshal` into.

### @harshavardhana
> Let's also add functional tests this time, so that these functionalities are tested.

### @klauspost
> This needs to be _seriously_ vetted for error handling and and races. I also see a `failed := true` I added that looks like it should have been `failed := false`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
