# deepspeedai/DeepSpeed #7391 — Add Zenflow code for Stage 1 & 2

**[View PR on GitHub](https://github.com/deepspeedai/DeepSpeed/pull/7391)**

| | |
|---|---|
| **Author** | @Antlera |
| **Status** | Merged (August 15, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tohtana
> Overall, I think we need to separate ZenFlow code and minimize changes for ZenFlow in existing code

### @tohtana
> Can you first try to separate the parts I mentioned first? Then we can discuss if we have a chance to do more.

### @Antlera
> I tried my best to avoid adding ZenFlow logic directly into engine and zero optimizer...full separation...might make future maintenance harder

### @sfc-gh-truwase
> should be fixed by #7481

(Regarding a PyTorch 2.8 version mismatch in CI.)

### @Antlera
> The CI failures on forked PRs are due to Modal authentication...forked PRs cannot access these secrets

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
