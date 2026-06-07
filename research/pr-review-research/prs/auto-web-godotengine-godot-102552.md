# godotengine/godot #102552 — Add shader baker to project exporter.

**[View PR on GitHub](https://github.com/godotengine/godot/pull/102552)**

| | |
|---|---|
| **Author** | @DarioSamo |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Calinou
> None of the D3D12 code is compiled in the Linux editor which is used for exporting on CI.

### @DarioSamo
> The shader classes aren't tied to a particular driver running. No GPU is required for the process.

### @stuartcarnie
> To support MSL and .metallib, we should extend `ShaderBinaryData`...Adding a field will require the version is updated.

### @DarioSamo
> The amount of work to make it build as a bandaid fix would be roughly equivalent to the amount of work to implement the shader container in Metal.

### @KeyboardDanni
> For my project the exporter doesn't take very long to bake, and startup times in the exported game are as slow as they are in editor.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
