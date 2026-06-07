# iced-rs/iced #2918 — Report cursor size to input method

**[View PR on GitHub](https://github.com/iced-rs/iced/pull/2918)**

| | |
|---|---|
| **Author** | @dcz-self |
| **Status** | Merged (November 25, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kenz-gelsoft
> I can agree to pass the caret Rectangle instead of the caret's bottom-left Point. As this PR fixes my ad-hoc caret size specification to 10x10.

### @dcz-self
> I'm sure that setting the size to 0 is wrong. The cursor area is where the window manager attaches the input method popup, so it's rather 'the area that should not be covered', rather than just the cursor.

### @kenz-gelsoft
> I tried this branch a few days ago. And I found it doesn't work well yet. It places the preedit as dcz-self written in... But it is not correct, I believe we should offset both of the preedit and the candidate window by the preedit's height.

### @hecrj
> A cursor width of 0 doesn't make sense regardless.

### @kenz-gelsoft
> It works well with all of left, bottom, right overflow scenarios at least macOS.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
