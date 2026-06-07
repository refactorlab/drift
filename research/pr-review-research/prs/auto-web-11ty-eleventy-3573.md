# 11ty/eleventy #3573 — Adds `html-relative` Passthrough Copy mode for relative asset references in HTML

**[View PR on GitHub](https://github.com/11ty/eleventy/pull/3573)**

| | |
|---|---|
| **Author** | @zachleat |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @darthmall
> Second, why make this a plugin? I understand wanting to maintain backwards compatibility for the existing passthrough copy function, but couldn't you achieve that by adding options to the passthrough copy function with default values that result in the existing behavior?

### @darthmall
> First, in your example with `<video src=video.mp4>` writing out both `_site/template/video.mp4` and `_site/template/index.html`, where does `video.mp4` live? Does it need to live in `content/template/video.mp4`?

### @wavebeem
> `'auto'` isn't especially specific, and boxes in the API if you want to make a new style in the future (hopefully not, but you never know).

### @Reedyn
> Any chance to make it detect the files to pass through based on the source rather than the output file?...The `html-relative` mode never detects the file since the source file is never directly referenced in the html-files.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
