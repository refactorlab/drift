# nushell/nushell #16079 — fix(engine, type-system)!: enforce assignment type annotations at runtime

**[View PR on GitHub](https://github.com/nushell/nushell/pull/16079)**

| | |
|---|---|
| **Author** | @mkatychev |
| **Status** | Merged (October 11, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @132ikl
> I'm just a bit confused on some things here...I want to make sure we know exactly how/why this fixes the issue, the interaction between the parse-time typechecking and run-time typechecking is a bit unclear.

### @132ikl
> In the meantime, would you be able to revert the implicit record->table typecheck change?

### @cptpiepmatz
> Do that so that we can see if the tests work. We should still use the experimental option. By using the `nu!` macro can you also set experimental options to run pipelines with

### @132ikl
> i think let's start with an experimental option so we can get this landed without much more fuss, and then evaluate how necessary warnings are when we transition the experimental option from opt-in to opt-out

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
