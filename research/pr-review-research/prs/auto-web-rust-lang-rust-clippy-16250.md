# rust-lang/rust-clippy #16250 — Add new `duration_suboptimal_units` lint

**[View PR on GitHub](https://github.com/rust-lang/rust-clippy/pull/16250)**

| | |
|---|---|
| **Author** | @sbernauer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @samueltardieu
> There is no need to leave the `Symbol` interning world to do string comparisons. You should stay with symbols as long as possible, that is until you print a diagnostic.

### @samueltardieu
> All values for those functions fit in a `u64`

(Recommending conversion from `u128` to `u64`, since the Duration constructors accept smaller types.)

### @samueltardieu
Suggested adding support for `Duration::from_days()` and `from_weeks()` by checking whether the `duration_constructors` feature is enabled, allowing extensibility for future stabilizations.

### @ada4a
> Using the rust version where the function was _constified_ is a bit.. surprising?

(Noting the lint should distinguish between const and non-const contexts, with explicit test coverage for both.)

### @ada4a
> it could make sense to prepend a `!expr.span.from_expansion()` check

(Recommending guards against macro-generated code to avoid spurious suggestions.)

### @ada4a
> This could become a problem if the original `Duration` was used qualified

(Advocating for `multipart_suggestion_verbose` to handle qualified paths like `std::time::Duration` correctly.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
