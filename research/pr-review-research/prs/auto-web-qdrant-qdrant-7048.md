# qdrant/qdrant #7048 — EncodedStorage upsert vector

**[View PR on GitHub](https://github.com/qdrant/qdrant/pull/7048)**

| | |
|---|---|
| **Author** | @IvanPleshkov |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @IvanPleshkov
> Push is not enough for an appendable segment where the user may update the vector. If `id` is not existing, quantization storage should create new one.

### @coderabbitai
> Prevent overflow when computing encoded_storage_size...Multiplying usize values can overflow silently before casting to u64, leading to truncated files and OOB writes during population.

### @coderabbitai
> Fix infinite recursion in `len()` implementation...`fn len(&self) -> usize { self.len() }` calls itself recursively. Call the inherent `Vec::len` explicitly.

**Note:** Human reviewers @timvisee (approved Aug 18) and @xzfc (reviewed Aug 15) left several inline comments that were marked resolved; their verbatim text did not load on the web view.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
