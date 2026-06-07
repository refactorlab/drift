# godotengine/godot #102987 — [LinuxBSD] Add support for HDR output (Wayland)

**[View PR on GitHub](https://github.com/godotengine/godot/pull/102987)**

| | |
|---|---|
| **Author** | @ArchercatNEO |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Zamundaaa
> If you don't provide HDR metadata, the compositor may (and KWin always does) clip the image to SDR range.

### @DarkKilauea
> Generally I'd expect a full implementation to support: [1] Declaring support for HDR [2] Getting HDR support from display [3] Telling RenderDevice to use HDR [4] Automatically responding to changes in HDR support

### @Zamundaaa
> Note that while you can have multiple wp_color_management_surface_feedback_v1, you can only have one wp_color_management_surface_v1 per Wayland surface at a time.

### @blueskythlikesclouds
> I think `get_colorspace_externally_managed` can be moved to `RenderingContextDriverVulkan` without a backing field.

### @bruvzg
> When project is started (on an HDR display), it is showing that HDR is not supported for the window. After dragging window to the non-HDR display and back it is correctly detected.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
