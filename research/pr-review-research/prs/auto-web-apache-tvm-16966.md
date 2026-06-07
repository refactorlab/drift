# apache/tvm #16966 — [SVE] Add support for representing and creating buffer-level predicates

**[View PR on GitHub](https://github.com/apache/tvm/pull/16966)**

| | |
|---|---|
| **Author** | @lhutton1 |
| **Status** | Merged (May 28, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Lunderberg
> The PR only adds `CreateMaskedLoad` when `TVM_LLVM_VERSION >= 110`. If somebody is using an older version of LLVM, it would silently ignore the predicate for the load/store.

### @Lunderberg
> Using `Optional<PrimExpr>` instead of `PrimExpr`

(Requested using an optional type for the predicate field to better represent when it is absent.)

### @Lunderberg
> Validating that `!predicate.defined()` in any target that does not support it

(To prevent silent failures on unsupported platforms.)

### @Lunderberg
> Can we add a test, parametrized over each target tested in CI, which attempts to compile a PrimFunc containing predicated loads/stores?

### @tqchen
> This style moving forward, instead, attach the target attribute to the PrimFunc itself

### @ekalda
Requested clarifications to docstrings and corrections to typos in error messages to improve code clarity and maintainability.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
