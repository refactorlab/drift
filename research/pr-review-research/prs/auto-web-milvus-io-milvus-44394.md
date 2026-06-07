# milvus-io/milvus #44394 — feat: support query aggregtion(#36380)

**[View PR on GitHub](https://github.com/milvus-io/milvus/pull/44394)**

| | |
|---|---|
| **Author** | @MrPresent-Han |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @coderabbitai (bot review — included for technical substance)
> The flag is set to `true` by `exchange()` (line 189) _before_ the initialization loop (lines 191-193). A concurrent thread can observe `operatorsInitialized_ == true`, skip the else-branch...

### @coderabbitai
> The `AggregateOp` enum starts with `sum = 0`, meaning unset aggregate operations will silently default to "sum" instead of being caught as validation errors.

### @coderabbitai
> IEEE 754 specifies `+0.0 == -0.0`, but `folly::hasher` will hash their distinct bit patterns to different values, violating the fundamental hash/equality contract.

### @coderabbitai
> `outputRowCount()` accesses `lookup_->newGroups_` without checking if `lookup_` is initialized.

### @coderabbitai
> `InitScalarFieldData` supports `DataType::GEOMETRY` (as `FieldData<std::string>`), but `ResizeScalarFieldData` has no `GEOMETRY` branch and will throw `DataTypeInvalid`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
