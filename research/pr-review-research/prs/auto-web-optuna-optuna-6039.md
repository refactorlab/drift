# optuna/optuna #6039 — Add a module to preprocess solutions for hypervolume improvement calculation

**[View PR on GitHub](https://github.com/optuna/optuna/pull/6039)**

| | |
|---|---|
| **Author** | @nabenabe0928 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @HideakiImamura
> Could you give us some benchmark results to calculate the hypervolume based on the existing WFG and newly introduced one?

### @kAIto47802
> I've reviewed the unit tests, leaving a comment.

### @kAIto47802
> I left other comments... [regarding box decomposition validity] — raising the concern of whether restricting to only Pareto solutions was mathematically valid.

### @nabenabe0928
> The Pareto maximal set in ND(P) is... [provided a formal proof that the upper-bound set contains all Pareto maximal solutions in the non-dominated space, addressing the validity concern].

### @kAIto47802
> I confirmed that the statement holds... the validity I mentioned above has been verified.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
