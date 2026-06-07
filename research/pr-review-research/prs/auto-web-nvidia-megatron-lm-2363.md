# NVIDIA/Megatron-LM #2363 — Add MTP support for hybrid models

**[View PR on GitHub](https://github.com/NVIDIA/Megatron-LM/pull/2363)**

| | |
|---|---|
| **Author** | @rkarimimahab |
| **Status** | Merged (later reverted due to test failures and re-merged as #3207 with bugfixes) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @shifangx
> Maybe we can use assert to guide users can not place mtp layers into different vpp stage currently, and support this feature in future.

### @deepakn94
> This is a good point. Let's go with the assertion for now re: 3.

### @BestJuly
> (Multiple technical review comments on the implementation across several files; verbatim text not fully captured on the rendered conversation page.)

### @yanring
> (Approved changes, indicating acceptance of the final implementation approach.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
