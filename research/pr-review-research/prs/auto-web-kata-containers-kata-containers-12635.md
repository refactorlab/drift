# kata-containers/kata-containers #12635 — runtime-rs: Update docs for runtime-rs

**[View PR on GitHub](https://github.com/kata-containers/kata-containers/pull/12635)**

| | |
|---|---|
| **Author** | @Apokleos |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stevenhorsman
> I need to try and run through some of the steps to validate them, but the general doc looks great and helpful.

### @LandonTClipp
> This docs PR is very large and hard for me to address everything. It will also most likely have many git conflicts due to the doc restructuring.

### @stevenhorsman
> Does the configuration format depend on whether v1, v2, or v3 of containerd is being used which depends on 1.7, or 2.1+ of containerd?

### @LandonTClipp
> Specific versions of dependencies should not be mentioned here because they're subject to change.

### @LandonTClipp
> Each step should be a separate header. My doc philosophy is that your table of contents should tell a story.

### @LandonTClipp
> I'm confused why the shim needs a wrapper. This isn't the case for Kata v3.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
