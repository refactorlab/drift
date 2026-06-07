# projectdiscovery/nuclei #6322 — Support concurrent Nuclei engines in the same process

**[View PR on GitHub](https://github.com/projectdiscovery/nuclei/pull/6322)**

| | |
|---|---|
| **Author** | @hdm |
| **Status** | Merged (July 18, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @coderabbitai
> Right now we have two separate settings for local-file access...because file.go first returns the global flag and only falls back to the per-instance value, you can get different answers

### @coderabbitai
> Consider using consistent mutex declaration style...declare m as a pointer...And initialize it in the Init function

### @coderabbitai
> If these template-specific fields are intentionally preserved (not replaced), please add a clear comment explaining why. Otherwise, remove the commented code

### @coderabbitai
> The commented debug log would be valuable for troubleshooting concurrent execution issues. Consider making it configurable rather than commenting it out

### @Mzack9999
> Follow ups: Multi-threading client pools ([BUG] multi-thread protocols clientpool maps don't release resources #6329)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
