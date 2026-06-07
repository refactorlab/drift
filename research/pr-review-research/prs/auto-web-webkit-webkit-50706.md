# WebKit/WebKit #50706 — Add support for loading USDs in WCP and rendering them in GPUP

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/50706)**

| | |
|---|---|
| **Author** | @mwyrzykowski |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rr-codes
> this is a bit bizarre; i think just having two separate overloads would be better and much more readable

### @mwyrzykowski
> This allows addMesh to be asynchronous. I don't think two separate methods allows this.

### @mwyrzykowski
> We intentionally use RemoteGPU for two reasons: (1) rendering the models requires access to a MTLDevice (2) we want the rendering to occur on the same thread as other GPU tasks so can eventually take advantage of WGSL shaders

### @rr-codes
> please try splitting up this PR as much as possible please

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
