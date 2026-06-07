# NVIDIA/Megatron-LM #4429 — Adding code for Flextron

**[View PR on GitHub](https://github.com/NVIDIA/Megatron-LM/pull/4429)**

| | |
|---|---|
| **Author** | @sheliang-nv |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Phlip79
> MambaModel has been renamed to HybridModel as of #4099. Can you please update this PR accordingly?

### @deepakn94
> make copyright year 2026

*(Note: much of the detailed review on this PR came from an automated Claude bot reviewer, which flagged config-coupling bugs — `ngroups` hardcoded to 8 vs. configurable `config.mamba_num_groups` causing silently-wrong parameter estimation — and missing unit-test coverage for the elasticity managers and `finalize_model_grads.py`. The human review comments are limited to the two above.)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
