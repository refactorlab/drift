# electron/electron #48149 — feat: add `copyVideoFrameAt` and `saveVideoFrameAs` methods on `webContents`

**[View PR on GitHub](https://github.com/electron/electron/pull/48149)**

| | |
|---|---|
| **Author** | @dodolalorc |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nikwen
> Thanks for working on this (and revising your approach to not require Chromium patches)!

### @samuelmaddock
> overall this looks good to me, but the added tests should be updated to verify that the video frame actually gets copied to the clipboard

### @jkleinsc
> @dodolalorc can you rebase your PR with the latest from main to pull in #48345? That will fix the build error.

### @nikwen
> We're seeing crashes in CI

(Stack traces indicated `DCHECK failed: !delta.is_negative()` on the Windows platform.)

### @samuelmaddock
> I managed to fix `MEDIA_ELEMENT_ERROR: Format error`...however, it still crashes on Windows

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
