# openai/whisper #2343 — Add option to carry initial_prompt with the sliding window

**[View PR on GitHub](https://github.com/openai/whisper/pull/2343)**

| | |
|---|---|
| **Author** | @kittsil |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ryanheise
> It's part of the model dimensions itself, actually 448 tokens total, and half that for the prompt. The logic is in decoding.py if you look for `self.n_ctx: int = model.dims.n_text_ctx`

### @kittsil
> I did find the left-slice in the code, and it turns out that the docs are wrong, as actually the maximum prompt length is `223`!

### @FurkanGozukara
> why this very important feature is still not merged @jongwook?

### @kittsil
> that's an issue with `whisper`, not with your prompt. You can try setting `compression_ratio_threshold` lower; I have found some success with `1.7`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
