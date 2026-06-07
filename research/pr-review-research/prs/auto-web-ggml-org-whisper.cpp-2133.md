# ggml-org/whisper.cpp #2133 — Add support for decoding input with ffmpeg (Linux)

**[View PR on GitHub](https://github.com/ggml-org/whisper.cpp/pull/2133)**

| | |
|---|---|
| **Author** | @WilliamTambellini |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ggerganov
> We can add the `FindFFmpeg.cmake` script in the `cmake` folder and use it to find `ffmpeg` libs

### @ggerganov
> Probably the conversion functionality should be implemented in `common.cpp` so that it can be reused by all examples, not just `main`

### @ggerganov
> Change the underscore in the filename to a dash for consistency: `ffmpeg-transcode.cpp`

### @clort81
> 'av_register_all' was not declared in this scope

### @Displacer
> #if LIBAVFORMAT_VERSION_MAJOR < 56 ... #endif

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
