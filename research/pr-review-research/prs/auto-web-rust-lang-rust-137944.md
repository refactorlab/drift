# rust-lang/rust #137944 — Sized Hierarchy: Part I

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/137944)**

| | |
|---|---|
| **Author** | @davidtwco |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidtwco
> This patch implements the non-const parts of RFC 3729. It introduces two new traits to the standard library, `MetaSized` and `PointeeSized`. These traits are unstable...not behind `cfg`s as this would make implementation unfeasible, there would simply be too many `cfg`s required.

*(The conversation page rendered with partial loading errors. Reviewers workingjubilee, lcnr, fee1-dead, fmease, and oli-obk participated in the review, but their substantive prose was not fully recoverable from the web page. The most concrete additional finding was a triaged 1.3% instruction-count regression that was marked as expected.)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
