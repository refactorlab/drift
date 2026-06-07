# huggingface/transformers #29077 — New model support RTDETR

**[View PR on GitHub](https://github.com/huggingface/transformers/pull/29077)**

| | |
|---|---|
| **Author** | @SangbumChoi |
| **Status** | ✅ merged (2024-06-21) · 👍5 🎉1 ❤️1 |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> In a convention-heavy codebase, review's job is to enforce the house pattern (label prep, file ordering, test selection) so the Nth model contribution reads like the first.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@amyeroberts:**
> Overall looking good - main comment is about the image processor preparing labels and the ordering of object definitions in the modeling file.

**@amyeroberts:**
> This highlights a case where we might want to update the run_slow logic... How to select which model isn't completely obvious — should we just do rt_detr?

**@ydshieh:**
> IMO, it's fine to just specify the folder name and run everything inside it.

**@SangbumChoi:**
> rt_detr_resnet architecture is not a standard resnet layer and also only used in this rt_detr, I made in same folder like mask2former-swin.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
