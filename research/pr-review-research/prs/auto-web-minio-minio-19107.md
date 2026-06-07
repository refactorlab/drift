# minio/minio #19107 — Enable replication of SSE-C objects

**[View PR on GitHub](https://github.com/minio/minio/pull/19107)**

| | |
|---|---|
| **Author** | @shtripat |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @poornas
> Did you test multipart replication? You will need additional changes

### @poornas
> the object is not decrypted properly, your test script is not correct... sse-c replication was not implemented initially because of decryption failures around part boundaries.

### @harshavardhana
> please update `make test-site-replication-minio` tests to start using SSE-C as part of the tests.

### @harshavardhana
> There is some persistent failure here looks like due to the changes in this PR... please investigate.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
