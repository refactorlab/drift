# gohugoio/hugo #14896 — Add image processing support for AVIF

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/14896)**

| | |
|---|---|
| **Author** | @bep |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmooring
> Note that lossless is currently only supported for WebP" should now read "lossless is currently only supported for AVIF and WebP

### @bep
> I'm curious as to how this behaves on other OSes (mostly Windows), so if you have a minute in the near future, it would be appreciated if you could build this Hugo branch and test

### @jmooring
> On my low quality display the SDR images look better

### @bep
> I'm considering this to be part of the v0.162.0 release — I certainly want/need this, which is a strong signal

### Copilot AI
> avifOpts.init() is never called... which can panic when the lazy AVIF dispatcher starts and tries to log

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
