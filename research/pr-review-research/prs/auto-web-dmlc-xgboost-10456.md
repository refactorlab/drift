# dmlc/xgboost #10456 — [R] Redesigned `xgboost()` interface skeleton

**[View PR on GitHub](https://github.com/dmlc/xgboost/pull/10456)**

| | |
|---|---|
| **Author** | @david-cortes |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mayer79
> I'd prefer helper functions like `process.x.and.col.args()` to be named like `_process_x_and_col_args()`.

### @trivialfis
> We can support COO internally, for CSC, maybe we can simply transpose in R. Do you think it can help the make code less complex?

### @trivialfis
> Is this going to make single thread the default for R xgboost?

### @trivialfis
> monotone_constraints and interaction_constraints might be better as a part of normal params? This way it feels more consistent.

### @trivialfis
> Since this is a new interface already, maybe it's better to do it right the first time if we know where the issue is? The internal implementation can be changed anytime we need, but changing the interface is particularly difficult, especially with the CRAN policy.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
