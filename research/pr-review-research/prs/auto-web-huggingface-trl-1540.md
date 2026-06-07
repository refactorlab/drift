# huggingface/trl #1540 — PPO / Reinforce Trainers

**[View PR on GitHub](https://github.com/huggingface/trl/pull/1540)**

| | |
|---|---|
| **Author** | @vwxyzjn |
| **Status** | Merged (May 22, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lapp0
> I think we should reduce the repetition, and use inheritance of existing classes so we can take advantage of the great infrastructure built out by huggingface/transformers and huggingface/trl.

### @lewtun
> Overall it's looking quite close to being finished and I think the main remaining points to address are splitting off the configs into their own modules and seeing if we can hide config variables like `world_size` from the end user

### @lapp0
> The main behavior difference is that it generates once per batch and runs for `num_train_epochs` rather than generating once per update... Have you experimented with updating once per batch, and if so, does this harm stability?

### @vwxyzjn
> After some refactoring / bug fixes, the new RLOO also seems much more stable. Will report when having newer results.

### @lapp0
> Did any of your RLOO runs result in improved benchmarks or at least improved score metrics? I was able to reproduce improving scores with ppov2... but I never managed to do the same with RLOO.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
