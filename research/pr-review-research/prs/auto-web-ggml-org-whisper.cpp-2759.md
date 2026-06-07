# ggml-org/whisper.cpp #2759 — Use miniaudio for direct decoding flac, mp3, ogg and wav

**[View PR on GitHub](https://github.com/ggml-org/whisper.cpp/pull/2759)**

| | |
|---|---|
| **Author** | @data-man |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ggerganov
> We can use this in the examples, but for now I don't plan to add audio decoding directly into `whisper.cpp`. It seems better to leave this to the user.

### @ggerganov
> Later on, if we can completely remove SDL dependency, it would be great. But I am not sure how difficult it would be.

### @data-man
> I think [miniaudio simple_capture.c] can be taken as template for audio recording.

### @satmandu
> This worked great! I was able to directly decode a `.flac` file of an old family interview without any additional conversion!

### @azkadev
> If it can be integrated into the shared library without any additional features, I really want this feature, because if I use ffmpeg it will be a problem because of its size.

### @data-man
> Yes, it is. All OS-specific sound I/O functions are disabled.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
