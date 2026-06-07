# zed-industries/zed #20400 — Windows: Add transparency effect

**[View PR on GitHub](https://github.com/zed-industries/zed/pull/20400)**

| | |
|---|---|
| **Author** | @dovakin0007 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jansol
> Acrylic and Mica materials have the same problem as NSVisualEffectView on macOS, i.e. they add a light/dark grey layer on top of the blurred content

### @jansol
> The method used here is different from what I remember seeing in Microsoft's documentation so I don't know if it applies the whole material.

### @dovakin0007
> the method is little different I tried how it was implemented in doc's didn't work had to set `DwmExtendFrameIntoClientArea` margins to -1 to make it work

### @jansol
> Make sure Zed isn't configured to automatically switch to a different theme when dark/light mode is switched

### @SomeoneToIgnore
> Given that everyone in the comments seem to be fine (or not against) with the change and this is Windows-only, let's merge this.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
