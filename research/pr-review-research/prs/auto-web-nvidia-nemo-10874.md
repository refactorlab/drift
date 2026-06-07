# NVIDIA/NeMo #10874 — NeMo 2.0 SFT PEFT notebooks

**[View PR on GitHub](https://github.com/NVIDIA/NeMo/pull/10874)**

| | |
|---|---|
| **Author** | @HuiyingLi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @shashank3959
> Please remove any (advanced) configurations that are not needed for a successful run with the data, especially if defaults work well.

*(Advocated reducing cognitive load by eliminating unnecessary configuration parameters like `store_optimizer_states` from beginner-focused notebooks.)*

### @shashank3959
> How does the user know if the training run is successful? WandB graphs? perplexity score on validation set?

### @HuiyingLi
> NeMo-Run has a 'SUCCEED' image/banner shown in the output cell when the run ends.

### @shashank3959
> What about chat templates to work with chat data? Do we have any specific config / docs for it?

### @shashank3959
> We should have eval metric computation in a follow-up PR.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
