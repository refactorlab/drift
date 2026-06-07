# BabylonJS/Babylon.js #17583 — Introduce selection outline layer

**[View PR on GitHub](https://github.com/BabylonJS/Babylon.js/pull/17583)**

| | |
|---|---|
| **Author** | @noname0310 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Popov72
> it should work with thin instances; it should work for custom shaders that modify vertex positions => this probably means that the pre-pass renderer should be used to generate the depth map

### @Popov72
> I also wonder if it should be in the main package or in the addon/ repository

### @noname0310
> Currently, rendering the outline of a mesh with thin instances is supported, but rendering each individual thin instance separately is questionable.

### @Popov72
> You can have a look at how SSAO2 has been implemented, for an example on how to support both the regular code path and the frame graph path.

### @noname0310
> I plan to understand the implementation using a pre-pass renderer and refactor it to the same level as the existing rendering pipeline.

### @Popov72
> Yes, I'll take care of it once the PR has been merged [regarding Frame Graph support].

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
