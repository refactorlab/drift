# plotly/plotly.py #5111 — Kaleido docs updates for v1

**[View PR on GitHub](https://github.com/plotly/plotly.py/pull/5111)**

| | |
|---|---|
| **Author** | @LiamConnors |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @emilykl
> Add section here (or elsewhere in the file) documenting the new `pio.write_images` function, recommended for exporting multiple images in a row because it is much faster than calling `pio.write_image` repeatedly.

### @emilykl
> `pio.write_images` should also be referenced in the Kaleido v1 migration doc, because anyone calling `write_images` many times in a row will notice a _significant_ performance hit unless they switch to using `pio.write_images`.

### @emilykl
> Should link to the Chrome setup instructions from this doc, since that's one of the major differences between Kaleido v0 and v1.

### @emilykl
> Looks great @LiamConnors ! 🚀 The `pio.write_images` documentation should be added; all my other comments are just minor details.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
