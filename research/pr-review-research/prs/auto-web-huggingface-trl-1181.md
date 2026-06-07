# huggingface/trl #1181 — Kto trainer

**[View PR on GitHub](https://github.com/huggingface/trl/pull/1181)**

| | |
|---|---|
| **Author** | @kashif |
| **Status** | Merged (February 19, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @younesbelkada
> I think it is fine to have code de-duplication for now, but maybe in the future we either want KTOTrainer to inherit from DPOTrainer, or create a new abstract class

### @lewtun
> Let's use this as an opportunity to group the hyperparameters under a dedicated `KTOConfig` class instead of having a mix of hyperparameters in `args` and the trainer init.

### @lewtun
> For unbalanced datasets, this will terminate whenever the minority class is exhausted... I suggest we document somewhere that this sampling strategy is being used

### @kawine
> The default behavior of this function is to stop when one of the datasets has been exhausted... I would suggest: setting the `stopping_strategy` kwarg to `all_exhausted`

### @lewtun
> I wonder if it is confusing for users to see a DPO data collator in a KTO trainer? Perhaps something to think about wrt having something named more generic

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
