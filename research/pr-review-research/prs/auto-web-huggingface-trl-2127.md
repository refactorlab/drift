# huggingface/trl #2127 — 🐾 Process-supervised RM Trainer

**[View PR on GitHub](https://github.com/huggingface/trl/pull/2127)**

| | |
|---|---|
| **Author** | @gaetanlop |
| **Status** | Merged (Dec 13, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lewtun
> Thank you for the very clean PR @gaetanlop - this looks great! I've left some minor suggestions regarding the structure, but aside from that and having a smallish dataset in the right format we can sanity check that the accuracy goes up, loss goes down etc I think this is quite close to being ready

### @gaetanlop
> Implementing a PRMs seems to be pretty straighforward, it seems to be a token classification task where only prediction for the last token of each step gets assigned a label and other tokens are ignored during loss calculation.

### @skepsun
> A suitable `step_separator` must be defined, ensuring it is always tokenized into a fixed token ID... The `get_reward` function already supports scoring across all positions, as it is also utilized by the value model.

### @qgallouedec
> Hey @gaetanlop. We were thinking that maybe renaming the trainer to `PRMTrainer` would make more sense. Do you agree?

### @gaetanlop
> Hello, sounds good to me, that's how I named it in my initial commits.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
