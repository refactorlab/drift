# huggingface/accelerate #3817 — Deepspeed Ulysses/ALST integration

**[View PR on GitHub](https://github.com/huggingface/accelerate/pull/3817)**

| | |
|---|---|
| **Author** | @stas00 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SunMarc
> Let's try to integrate it into HF Trainer before merging this PR. Once it is tightly coupled to Trainer, even if the API is marked as experimental, we will most likely try to limit breaking changes.

### @SunMarc
> There are some e2e examples in the example/torch_native_parallelism folder but we are not running them in the CI.

### @egangu
> the current implementation automatically skips it...Rolling back the accelerate version to 1.11 will enable the original CP.

### @kashif
> thanks for the report @egangu let me test and fix

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
