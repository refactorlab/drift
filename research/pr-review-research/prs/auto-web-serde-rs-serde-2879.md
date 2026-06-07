# serde-rs/serde #2879 — add `#[allow(deprecated)]` to derive implementations

**[View PR on GitHub](https://github.com/serde-rs/serde/pull/2879)**

| | |
|---|---|
| **Author** | @rcrisanti |
| **Status** | Merged (by dtolnay on Sep 16, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dtolnay
> I don't like this workaround because it silently suppresses legitimate deprecations on parts of the generated impl that come from user-specified attributes.

### @rcrisanti
> Now we only add the `#[allow(deprecated)]` if the struct/enum has `#[allow(deprecated)]` or `#[deprecated]` or if one of its variants do

### @oli-obk
> in theory that check should work for serde automatically, but making that happen at the proc macro level causes lots of problems inside other diagnostics

### @rcrisanti
> in rust itself they hide deprecation messages in derives, so in my opinion this would put serde more inline with expected behavior

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
