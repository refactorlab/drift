# huggingface/candle #3195 — Add dummy dtypes

**[View PR on GitHub](https://github.com/huggingface/candle/pull/3195)**

| | |
|---|---|
| **Author** | @EricLBuehler |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ivarflakstad
> Doesn't have to be in this PR, but I'd prefer to hoist this out into a helper fn.

### @ivarflakstad
> I have an idea for how to reduce the massive size of this match. Adding it to the ever growing list of things to do :)

### @zackangelo
> signed dtypes are nice 👌 I've been having to pass u32s as i32s in cuda launch code and have been worried that would blow up in my face at some point

### @ivarflakstad
> You resolved this but looks the same to me?

### @ivarflakstad
> Not related to this PR, just noting down while I'm here: we should use temp files for these kinds of tests.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
