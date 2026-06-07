# servo/servo #31417 — Initial internal support for multiple webviews

**[View PR on GitHub](https://github.com/servo/servo/pull/31417)**

| | |
|---|---|
| **Author** | @wusyong |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @delan
> WebViewVisibilityChanged notifies script that a webview has become invisible due to the native window or app activity, whereas ShowWebView and HideWebView tell the compositor to add or remove it from webrender

### @delan
> I guess we either need to finish and enable the multiview feature in this patch, or fix the viewport coordinates when multiview is disabled

### @delan
> Thanks for rebasing this, it's coming along well. I've edited in a description of the changes in this patch, and updated the description in #30648.

### @delan
> While testing these changes, I thought I found another regression with multiview disabled, but it actually affects main too (#31539)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
