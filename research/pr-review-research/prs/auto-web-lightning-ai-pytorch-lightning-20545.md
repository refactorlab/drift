# Lightning-AI/pytorch-lightning #20545 — Generic weight averaging callback that supports EMA

**[View PR on GitHub](https://github.com/Lightning-AI/pytorch-lightning/pull/20545)**

| | |
|---|---|
| **Author** | @senarvi |
| **Status** | Merged (August 15, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lantiga
> It would be nice to make it configurable, and probably users will want to get to some minimum and then start averaging...allowing the user to implement a custom hook to decide whether to start averaging or whether to average at a given step would be super handy.

### @lantiga
> I think this is ok, but my doubt with forcing `use_buffers` to be true is what happens when a user has a module with buffers in it that are not meant to be averaged.

### @lantiga
> The other question I have (for the future) is related to fitting both models on GPU. It may make sense to give the ability to keep the AveragedModel on a different device (e.g. `cpu`).

### @scurkovic
> Questioned whether the test stage needs weight swapping like validation does, and raised concerns about accessing averaged weights outside the trainer for export workflows. *(paraphrased — verbatim text did not load)*

### @kzrpg
> Asked about supporting sharded models with DeepSpeed/FSDP, noting the warning about configure_model incompatibility. *(paraphrased — verbatim text did not load)*

### @amorehead
> Documented a caveat: resuming training after reaching max_epochs can cause validation performance drops because averaged weights become the baseline for further training. *(paraphrased — verbatim text did not load)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
