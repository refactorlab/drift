# sharkdp/bat #3576 — feat: Map BUILD to Python (Starlark) for Bazel (fixes #3575)

**[View PR on GitHub](https://github.com/sharkdp/bat/pull/3576)**

| | |
|---|---|
| **Author** | @vorburger |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cyqsimon
> The addition of the `case_sensitive_mappings` table [is] rigid and lacks consideration for future extensibility. Because fundamentally, **case-sensitivity is a property of a particular rule**... Much better I think is to use the approach taken by `Cargo.toml`'s dependency table, where you can either specify a dependency with version only... or with additional properties.

### @cyqsimon
> The `Matcher` type used to serve double-duty... The problem is, in the current design the 'case-sensitivity' info isn't provided during parsing... This existence of invalid states (no matter how briefly it exists) goes contrary to one of Rust's core philosophies - 'make invalid states unrepresentable'.

### @cyqsimon
> In code like this where you name both a property and its inverse (e.g. here, both `sensitive` and `insensitive`), it's very easy to accidentally flip the logic in the implementation... Much better would be to use a enum, something like this: enum Case { Sensitive, Insensitive, }

### @cyqsimon
> I think this is the exact situation [`#[serde(from = "FromType")]`](https://serde.rs/container-attrs.html#from) is designed for no? Then you're just writing a `impl From<RawMatcher> for Matcher` which should be much less arcane.

### @keith-hall
> Yep, looks like Copilot is correct about the case-insensitivity, which is indeed why the tests are failing... we need to introduce a way to map a filename case sensitively to proceed further.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
