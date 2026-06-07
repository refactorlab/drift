# zed-industries/zed #21675 — Add image dimension and file size information

**[View PR on GitHub](https://github.com/zed-industries/zed/pull/21675)**

| | |
|---|---|
| **Author** | @kaf-lamed-beyt |
| **Status** | ✅ merged (2025-02-07) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> A rejection paired with a path forward. `jansol` kills the cramped status-bar UX; `mikayla-maki` doesn't just say no — she points the contributor to the exact pattern (`StatusItemView`) to learn. Review as mentorship.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@jansol:**
> Don't. That won't work well if someone opens multiple images side by side. Also there is very limited space in the status bar and I would very much like to see a lot more metadata (file format; color format - channels, bit depth, subsampling, etc; physical size/DPI; comment; whether the file has color profile; ...)

**@iamnbutler:**
> My first instinct is that the bottom right of the toolbar should be used to show this metadata. In buffers, that is cursor position, selected lines, characters, etc. So for images it would make sense for it to show file size, dimensions, etc.

**@mikayla-maki:**
> You'll have to figure it out if you want to ship this PR. I'd suggest looking at the cursor position UI, and learning how it's hooked into the rest of Zed. The key trait you'll want to understand is StatusItemView...


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
