# godotengine/godot #94496 — [Windows] Support output to HDR monitors

**[View PR on GitHub](https://github.com/godotengine/godot/pull/94496)**

| | |
|---|---|
| **Author** | @DarkKilauea |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Calinou
> HDR Max Luminance affects both 2D (UI) and 3D rendering. Is that intended?

### @Calinou
> The HDR editor setting is not applied instantly when you change it, even though the demo project shows a working example of it being toggled at runtime.

### @allenwp
> It appears that the recent optimizations to retrieving HDR screen info have broken the detection of changes from SDR to HDR

### @clayjohn
> We discussed this in the rendering meeting and agree that we are very happy with the exposed API and the implementation. The only outstanding thing is that minor change from std140 vs. std430 and the need to mark a few of the functions as experimental.

### @alvinhochun
> The over-exposure in your screenshot is expected, but the colours are oversaturated because it is missing a colour space conversion. The colours need to be converted from BT.709 primaries to BT.2020 primaries.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
