# zellij-org/zellij #4768 — [Windows port PR8] feature: add Windows support

**[View PR on GitHub](https://github.com/zellij-org/zellij/pull/4768)**

| | |
|---|---|
| **Author** | @divens |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @imsnif
> Personally, I find it hard to read code with variables that conditionally exist depending on the platform. Could we please either defer their creation to a different function or create them regardless...

### @imsnif
> I think we set the `crt-static` field on the windows `no-web` build but don't set it on the windows default build - so it won't be portable in the same way?

### @imsnif
> Regarding the KKB - let's forget about it for now and optionally add it as an enhancement later. I think even if we have all the data...

### @imsnif
> Regarding the timeout - you're right, let's keep a static default timer and allow it to be overridden with a `--server-startup-timeout` flag, ok?

### @imsnif
> The CLI help is generally intended for users rather than developers...I'd have worded the help more in the lines of 'Windows only' rather than going into explanations about TCP...

### @imsnif
> Does Windows have the concept of package managers? Something similar? How do people normally install this sort of software on windows?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
