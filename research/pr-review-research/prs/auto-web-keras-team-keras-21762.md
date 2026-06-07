# keras-team/keras #21762 — Added OrbaxCheckpoint for keras 3.0 for Data centric saving and restore

**[View PR on GitHub](https://github.com/keras-team/keras/pull/21762)**

| | |
|---|---|
| **Author** | @amitsrivastava78 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hertschuh
> Does this as-is support all backends? Does this support JAX sharding? I don't see anything related to sharing (which may be normal). What about re-sharding?

### @hertschuh
> The JAX implementation of `def process_id()` is missing.

### @hertschuh
> Thanks for the PR. This checkpointing system has a ton of features!

### @gemini-code-assist
> There are critical correctness and performance bugs in the main implementation: the batch-based saving logic is flawed, and the asynchronous saving feature is effectively disabled by blocking calls.

### @gemini-code-assist
> This pull request introduces `OrbaxCheckpoint`, a new Keras callback for advanced checkpointing using the Orbax library...enabling asynchronous saving, customizable save policies, and the ability to save complex states.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
