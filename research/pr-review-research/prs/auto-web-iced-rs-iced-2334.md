# iced-rs/iced #2334 — Adding feature: Image rotation

**[View PR on GitHub](https://github.com/iced-rs/iced/pull/2334)**

| | |
|---|---|
| **Author** | @DKolter |
| **Status** | Merged (May 3, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Gigas002
> The image widget's layout modification changes the way image displayed when loaded for me.

### @DKolter
> The rotation should probably be done before the content fit layout applies, is that correct?

### @Gigas002
> The `ContentFit::None`'s behavior seems a little bit off. Resizing the window doesn't change image size, as expected. However, it changes image, or maybe the widget position, while it shouldn't

### @hecrj
> I have simplified and renamed some stuff here and there. The most important change is the removal of the `scale` argument to `draw_image` and `draw_svg`. It seemed redundant since we are already providing specific image `bounds`.

### @DKolter
> I was able to reproduce the issue, it only appears with the wgpu backend, which suggests that there is an issue with either the transformations applied in the shader or with the way the image is being split into parts when it is too large.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
