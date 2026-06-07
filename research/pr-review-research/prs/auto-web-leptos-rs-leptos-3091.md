# leptos-rs/leptos #3091 — Add support for user-supplied executors

**[View PR on GitHub](https://github.com/leptos-rs/leptos/pull/3091)**

| | |
|---|---|
| **Author** | @stefnotch |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @benwis
> It looks like you have three PRs, #3989 #3990 and this one, that overlap and add mostly same code. Is that correct?

### @stefnotch
> this PR builds on top of the code of #3089

(suggested merging this one while closing the others)

### @benwis
> Looks like the CI is complaining about formatting. Can you run it through cargo fmt?

### @stefnotch
> Executor::init_futures_executor() may only be called once...Those are shared across Rust unit tests, because all tests run in the same process.

### @raskyld
> I think you can solve the issue by adding a const...then, you could add an helper function that use...call_once to call the init function only once.

### @stefnotch
> Figured it out! I just had to use integration tests instead of unit tests...they get run in a separate process.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
