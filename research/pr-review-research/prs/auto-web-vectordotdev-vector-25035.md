# vectordotdev/vector #25035 — enhancement(transforms): dynamic rate for sample

**[View PR on GitHub](https://github.com/vectordotdev/vector/pull/25035)**

| | |
|---|---|
| **Author** | @jh7459-gh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pront
> The example config in the PR body combines `ratio_field` with `key_field`: But `config.rs` now rejects this combination (`InvalidKeyFieldDynamicCombination`). Anyone copy-pasting this will get a validation error.

### @pront
> In the `FunctionTransform::transform` impl, `group_by_key` is computed but never passed to the dynamic sampling functions... a user can configure `group_by` + `ratio_field` and it will be silently ignored whenever the dynamic field is present.

### @pront
> Consider encoding the mutual exclusion in the type system, e.g.: `enum SampleKeySource`. The constructor would take `SampleKeySource` instead of separate `key_field` + `DynamicSampleFields` args. This makes it impossible to construct the invalid combination.

### @pront
> `website/cue/reference/components/sinks/generated/greptimedb_logs.cue` has a whitespace-only formatting change unrelated to this PR. Please drop it.

### @pront
> The PR body's 'Keyed static sampling' example combines `ratio_field` with `key_field` which is not valid.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
