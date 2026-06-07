# godotengine/godot #97210 — Add an ObjectDB Profiling Tool

**[View PR on GitHub](https://github.com/godotengine/godot/pull/97210)**

| | |
|---|---|
| **Author** | @AleksLitynski |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Calinou
> I'd make the snapshot store the exact Godot version (including commit hash) that was used to generate it, so that you can compare it in diffs.

### @Calinou
> Loading the JSON tab can take a long time (easily 10+ seconds on a high-end machine when comparing two snapshots on Truck Town), so I suggest displaying some kind of 'Generating JSON, this may take a while...' text.

### @Faless
> Editor code should go in an `editor` subfolder (inside the module folder) and only be included for editor builds. My feeling is that we should not build the module at all in release builds.

### @KoBeWi
> I think the last major thing to address is the orphan nodes being mixed with node tree. You could just put them into a parent item named 'Orphan Nodes', and possibly give them some distinct icon.

### @WhalesState
> Setting size flags are not needed for children of Control nodes... all theme changes should be updated inside `NOTIFICATION_THEME_CHANGED`, and margins should be multiplied by `ED_SCALE`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
