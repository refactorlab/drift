# ggml-org/whisper.cpp #3065 — vad : add initial Voice Activity Detection (VAD) support

**[View PR on GitHub](https://github.com/ggml-org/whisper.cpp/pull/3065)**

| | |
|---|---|
| **Author** | @danbev |
| **Status** | ✅ merged |
| **Opened** | 2025-04-22 |
| **Repo importance** | ★50,494 · 5,621 forks · score 77,971 |
| **Diff** | +2154 / −193 across 11 files |
| **Engagement** | 24 conversation · 28 inline review comments |

## Top review comments (ranked by reactions)

### @danbev — 3 reactions  
`👍 3`  ·  [link](https://github.com/ggml-org/whisper.cpp/pull/3065#issuecomment-2831915828)

> > Are there plans to add vad support for `server` or this is a goal after the PR is merged?
> 
> I think it would be nice to get an initial version merged first as this PR is quite large as it is. I can then start looking at adding support to the server, and hopefully during that time people can start trying this out and see what works and does not work. 
> 
> I'm adding the remaining options to whisper-cli now and after that this should be ready for review.

### @ggerganov — 3 reactions  
`👍 1 · 👀 2`  ·  [link](https://github.com/ggml-org/whisper.cpp/pull/3065#issuecomment-2841788667)

> I am doing some initial testing using long audio and `large-v3-turbo` and it looks like the quality improves significantly when pre-processing the audio with a VAD.
> 
> I am wondering if we can somehow align the output timestamps with the original audio? Right now, I think that the audio that is cut out is not taken into account, so the final timestamps are not aligned with the input audio and it is a bit difficult to evaluate the results.

### @ggerganov — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/ggml-org/whisper.cpp/pull/3065#issuecomment-2868654668)

> I did some minor refactoring and style normalization. There a few more things to polish before merge:
> 
> The `struct whisper_vad_timestamps` should become oblique. The API should look something like this:
> 
> ```c
> // oblique
> struct whisper_vad_timestamps;
> 
> WHISPER_API struct whisper_vad_timestamps * whisper_vad_timestamps_from_probs(
>         struct whisper_vad_params params,
>         struct whisper_vad_speech * probs);
> 
> WHISPER_API int whisper_vad_timestamps_n_segments(struct whisper_vad_timestamps * timestamps);
> 
> WHISPER_API float whisper_vad_timestamps_get_segment_t0(struct whisper_vad_timestamps * timestamps, int i_segment);
> WHISPER_API float whisper_vad_timestamps_get_segment_t1(struct whisper_vad_timestamps * timestamps, int i_segment);
> 
> WHISPER_API void whisper_vad_free_timestamps(struct whisper_vad_timestamps * timestamps);
> ```

### @MahmoudAshraf97 — 2 reactions  
`👍 2`  ·  [link](https://github.com/ggml-org/whisper.cpp/pull/3065#issuecomment-2869159969)

> Hello @danbev , I saw your [notes](https://github.com/danbev/learning-ai/blob/main/notes/vad.md) and I figured I can help by sharing two reference implementations of Silero V5 model in pytorch, these are verified to work exactly as the original model and they are used in [faster-whisper](https://github.com/SYSTRAN/faster-whisper/) (I'm the current maintained btw)
> 
> 1. [Most Recent](https://gist.github.com/MahmoudAshraf97/7ed36a87c874a8354cea36670feb3a0d): this is used in a high-throughput environment where you can batch both single audio files and multiple audio files, it reproduces the original model probabilities with 1e-5 atol
> 2. [Initial Implementation](https://gist.github.com/MahmoudAshraf97/29f73de73beb8e4549dedb8b5eac9702) This is the one used in faster whisper, I'd suggest using the first one as it's simpler IMO, but this one can give you more insights and details if needed
> 
>  Both implementations are almost 3x faster than the original implementation due to batching while producing the same results, they also decouple state management from the model class for easier understanding and implementation
> 
> LMK if I can be of any help
> Best,

### @vrs — 2 reactions  
`👍 2`  ·  [link](https://github.com/ggml-org/whisper.cpp/pull/3065#issuecomment-2873243334)

> Would it be possible to leave --vad as longform flag only? -v usually means --verbose or (sometimes) --version.

### @ggerganov — 1 reactions  
`👍 1`  ·  [link](https://github.com/ggml-org/whisper.cpp/pull/3065#issuecomment-2858583911)

> We should eventually figure out why the GPU inference fails, but we can do it later. For now, we should add a way to easily enable GPU vad, and have it disabled by default.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
