# Lightning-AI/pytorch-lightning #19846 — (1/n) Support 2D Parallelism

**[View PR on GitHub](https://github.com/Lightning-AI/pytorch-lightning/pull/19846)**

| | |
|---|---|
| **Author** | @awaelchli |
| **Status** | Merged (May 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @carmocca
> I find this name confusing. Data-parallelism is not model parallelism yet this class supports both. Can we think of something else? What about `ManualParallelStrategy`?

### @carmocca
> CI runs with 2 devices. This could introduce a deadlock if PyTorch adds a collective call in the device mesh. Could we change it to 2 just in case?

### @awaelchli
> For 2D I need at least 2*2=4 devices. What do you mean this could add a deadlock. Where? I'm calling it on all ranks.

### @carmocca
> Worth leaving a comment then because as a user I would be confused about the impact of doing this and setting `precision="something"` in Fabric

### @carmocca
> Be aware then that this will not run on our CI (gets skipped) because all our agents run with only 2 visible CUDA devices.

### @awaelchli
> Some discussion internally to consider another name, will rename the strategy in a follow up if we converge to a final decision.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
