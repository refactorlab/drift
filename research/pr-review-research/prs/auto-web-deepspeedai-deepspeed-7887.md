# deepspeedai/DeepSpeed #7887 — [SP] add SP deny list instead of allow

**[View PR on GitHub](https://github.com/deepspeedai/DeepSpeed/pull/7887)**

| | |
|---|---|
| **Author** | @kashif |
| **Status** | Merged (April 1, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tohtana
> We probably need to do the proper registration steps: Reject known-bad impls explicitly...If `core_attn_implementation` is an HF hub kernel string, call the HF registration path first.

### @stas00
> We actually don't know if flex_attention is bad, we just haven't tried it out. Do you have resources to try it out, Kashif?

### @kashif
> With SP=4 (4 GPUs): sdpa and flex_attention match each other, but both diverge significantly from flash_attention_2

### @stas00
> to make things more exact - it's packed samples + pos ids + 4D `attention_mask=None` where sdpa silently does the wrong thing.

### @kashif
> Generate `position_ids` in `UlyssesSPDataLoaderAdapter.refill()` BEFORE `all_gather` and sharding, so each rank gets correct global positions.

### @stas00
> Warnings don't work and allowing invalid training can be so so costly to the user who missed the warning in the sea of warnings.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
