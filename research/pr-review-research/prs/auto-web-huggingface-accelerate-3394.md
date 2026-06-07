# huggingface/accelerate #3394 — Initial FSDP2 support

**[View PR on GitHub](https://github.com/huggingface/accelerate/pull/3394)**

| | |
|---|---|
| **Author** | @S1ro1 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @muellerzr
> Note that in general, users will ignore `warnings` (and will get annoyed it bloats the logs). So we should instead use `logger.warn` if we don't want to explicitly raise an error about this.

### @muellerzr
> Instead of doing many `warning.warn`s, let's accumulate them all and do one big `logger.warn` at the end

### @stevhliu
> The main feature of FSDP2 is `DTensor`, but I didn't really realize it's significance until the following section...I wonder if it'd be better to start with that section so users understand what `DTensor` is

### @kmehant
> Should we make this `2.6.0`? Since imports such as CPUOffloadPolicy...would break for any version below 2.6.0

### @kmehant
> you might also want to protect imports since the imports seem to break first even before we hit this condition

### @muellerzr
> For now we should maintain until PyTorch is fully removed with the old or accelerate 2.0 IMO. It's fully breaking on the pytorch side

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
