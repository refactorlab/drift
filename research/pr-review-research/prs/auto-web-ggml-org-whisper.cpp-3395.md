# ggml-org/whisper.cpp #3395 — Add support for --carry-initial-prompt

**[View PR on GitHub](https://github.com/ggml-org/whisper.cpp/pull/3395)**

| | |
|---|---|
| **Author** | @alubbe |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ggerganov
> I think the main complexity comes from using a single `prompt_past` vector in the `whisper_state` which results in some convoluted logic for deduplicating and slicing the tokens.

### @ggerganov
> I expect that the logic can become much simpler if you replace `prompt_past` with 2 vectors: `prompt_past0` and `prompt_past1`. The full prompt is a concatenation of `prompt_past0 + prompt_past1`.

### @alubbe
> I think that this assumes the entire `prompt_past0` is always included in the prompt, but that's not guaranteed. For example, if `max_ctx_half - 1 < prompt_past0.size()`, we only take a tail of `prompt_past0`, not all of it.

### @ggerganov
> Should we truncate `prompt_past0` upon initialization so that it does not exceed the `max_ctx_half`?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
