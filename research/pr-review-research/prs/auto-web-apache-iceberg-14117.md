# apache/iceberg #14117 — SPEC: Add SQL UDF spec

**[View PR on GitHub](https://github.com/apache/iceberg/pull/14117)**

| | |
|---|---|
| **Author** | @flyrain |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stevenzwu
> should `name` be immutable? typically function signature (like Java) doesn't include parameter name

### @rdblue
> parameter renaming is not allowed. hence, we require the `name` and `type` are immutable

### @rdblue
> Prefer exact parameter matches over safe (widening) or unsafe casts...Safely widen types as needed...Require explicit casts for unsafe conversions

### @wgtmac
> Do we allow nullable parameter? I just saw the expected behavior if any input is null. Do we need finer-grained control?

### @rdblue
> do we want to state that this is monotonically increasing or just go with it as-is?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
