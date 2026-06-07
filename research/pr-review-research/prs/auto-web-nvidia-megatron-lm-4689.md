# NVIDIA/Megatron-LM #4689 — Fix unit tests

**[View PR on GitHub](https://github.com/NVIDIA/Megatron-LM/pull/4689)**

| | |
|---|---|
| **Author** | @shanmugamr1992 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tdene
> Why do we have this diff inside this file? What's wrong with the original `is_torch_min_version`?

### @tdene
> This test is not necessary: this is a fundamental guarantee in `torch`.

### @tdene
> Every single test in this class should be combined as part of a bigger lifecycle test. Please see `test_data_parallel_inference_coordinator.py`...

### @santhnm2
> Can we rename this so it's more differentiated from the existing `test_dynamic_engine.py`?

### @santhnm2
> Is this file intended to be committed?

### @tdene
> This test can be folded into `test_add_request_increments_id_and_sends`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
