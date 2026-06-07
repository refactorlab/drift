# ggml-org/whisper.cpp #3065 — vad : add initial Voice Activity Detection (VAD) support

**[View PR on GitHub](https://github.com/ggml-org/whisper.cpp/pull/3065)**

| | |
|---|---|
| **Author** | @danbev |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ggerganov
> I am wondering if we can somehow align the output timestamps with the original audio? Right now, I think that the audio that is cut out is not taken into account, so the final timestamps are not aligned with the input audio

### @ggerganov
> I am not sure if this is the best logic for restoring the timestamps because it is scaling the speech back to the original length of the segment.

### @ggerganov
> We should eventually figure out why the GPU inference fails, but we can do it later. For now, we should add a way to easily enable GPU vad, and have it disabled by default.

### @ggerganov
> Add example to to split input file into VAD segments; Add WASM/CLI example for real-time VAD; Improve performance

### @vrs
> Would it be possible to leave --vad as longform flag only? -v usually means --verbose or (sometimes) --version.

### @mdestagnol
> by using Silero to detect in real time when can we chunk the audio (during silences) + a sliding window with some overlap we could get the real time example to be more accurate

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
