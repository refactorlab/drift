# keras-team/keras #21551 — feat(quantization): Add GPTQ n-bit quantization support

**[View PR on GitHub](https://github.com/keras-team/keras/pull/21551)**

| | |
|---|---|
| **Author** | @amitsrivastava78 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @amitsrivastava78
> This commit integrates the GPTQ (Generative Pre-trained Transformer Quantization) algorithm into Keras. Key features include: A new `GPTQConfig` for configuring quantization parameters. Integration with base Keras models via a `model.quantize()` method. Support for custom dataset and tested models (GPT-2, OPT, Bloom, gemma3 etc). Includes unit tests to verify perplexity and model functionality post-quantization.

> **Note:** This PR drew 320 comments, but nearly all of the substantive review was conducted in inline code-review threads whose prose is lazy-loaded on the conversation page and was not web-retrievable without the GitHub API. The reviewers of record on the thread were **@fchollet**, **@divyashreepathihalli**, **@hertschuh**, and **@JyotinderSingh** (plus the gemini-code-assist bot). The single verbatim top-level comment that was retrievable is the author's PR description above.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
