# raysan5/raylib #4832 — [rlgl] Add Software Rendering Support

**[View PR on GitHub](https://github.com/raysan5/raylib/pull/4832)**

| | |
|---|---|
| **Author** | @Bigfoot71 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ColleagueRiley
> This repeats a lot of code that RLGL does for you. RLGL already handles the OpenGL 1 like abstraction and the marxies, so I think it would make more sense to build from the modern opengl setup and render everything in `rlDrawRenderBatch`.

### @ColleagueRiley
> I think it's more important RLGL is refactored to support additional backends. Not only to make this software rendering backend, but it would help users that want to add custom support for the native graphics API.

### @Bigfoot71
> The first is that we will be able to integrate its implementation directly into the parts currently dedicated only to OpenGL 1.1 only, we can therefore also be sure that it does not generate any duplication during the build.

### @raysan5
> I see most `rlsw` functions map directly to OpenGL 1.1 counter-parts so it would be nice that the OpenGL1.1-mapping was done directly in the `rlsw` header, so in `rlgl` it can be simply implemented using...

### @CalSch
> I was able to use this to use Raylib on a Raspberry Pi Pico! I had to remove some code (for things like filesystem usage), it's quite slow (to be expected)...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
