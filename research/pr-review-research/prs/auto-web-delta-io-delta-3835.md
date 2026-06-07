# delta-io/delta #3835 — [Kernel] Add Domain Metadata support to Delta Kernel

**[View PR on GitHub](https://github.com/delta-io/delta/pull/3835)**

| | |
|---|---|
| **Author** | @qiyuandong-db |
| **Status** | Merged (Nov 25, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zachschuermann
> is this a typical pattern? something that returns `DomainMetadata` may just return `null`? should we document that if so?

### @scottsand-db
> (in the resulting thread) this is a broader Kernel pattern worth revisiting in a separate PR using `Optional` instead.

### @tedyu
> For `removed`, we should use `%b`

### @tedyu
> I think this field should be called `domainMetadataList` since metadata is already the plural.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
