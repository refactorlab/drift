# scrapy/scrapy #7283 — Added DOWNLOAD_BIND_ADDRESS setting for download handlers

**[View PR on GitHub](https://github.com/scrapy/scrapy/pull/7283)**

| | |
|---|---|
| **Author** | @jhamze7 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wRAR
> Great work so far, I think this is missing: removing `_is_dns_error()`, skipping the test on macOS, a test for `{"DOWNLOAD_BIND_ADDRESS": "127.0.0.2"}`

### @wRAR
> No, but it seems that we need to skip the test on macOS.

### @jhamze7
> I removed the `_is_dns_error` function and added a `"nodname nor servname" in str(e)` check

### @jhamze7
> On macOS, only explicitly configured loopback addresses are bindable by default

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
