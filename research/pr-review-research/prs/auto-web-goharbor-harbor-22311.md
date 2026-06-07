# goharbor/harbor #22311 — Full Multi-Architecture Enablement for Harbor (amd64 + arm64)

**[View PR on GitHub](https://github.com/goharbor/harbor/pull/22311)**

| | |
|---|---|
| **Author** | @ranimandepudi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Vad1mo
> So we actually need to perform all the tests on both architectures, AMD and ARM?

### @ranimandepudi
> Offline installer tests pass on both arm and amd - images building are arch neutral and healthy. Online failed on arm64 as they try to pull Harbor images from Docker hub and those are amd64 only today!

### @chlins
> Please resolve the conflict, and it seems it will break current CI pass right now.

### @Copilot
> If `assetsPath` already exists, stale checksums can remain and md5sum file will contain entries from multiple runs.

### @evrardj-roche
> If changes are not conflicting, is there a reason for the workflows to wait for approval?

### @bupd
> I have tested and verified the builds and the ci - works as expected.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
