# optuna/optuna #5274 — Enhance performance of GPSampler

**[View PR on GitHub](https://github.com/optuna/optuna/pull/5274)**

| | |
|---|---|
| **Author** | @contramundum53 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @contramundum53
> This PR enhances the performance of `GPSampler` to the same level of (if not above) BoTorch.

### @contramundum53
> Note that our sampler is designed for real-world problems...real-world hyperparameter optimization problems have different characteristics from benchmark functions...Most notably, real-world problems tend to be smoother in global landscape but is often noisy in heterogeneous way and sometimes ill-scaled.

### @nabenabe0928
> Requested clarification on the algorithm implementation details in the `optimize_acqf_mixed` function, specifically around the coordinate-descent and restart-strategy mechanics, to ensure code readability. (Paraphrase of an inline review thread; verbatim prose was lazy-loaded and not web-retrievable.)

### @nabenabe0928
> Flagged a concern about numerical-stability thresholds in the `gtol` parameter specification, requesting clarification on the chosen tolerance values. (Paraphrase of an inline review thread; verbatim prose was lazy-loaded and not web-retrievable.)

> **Note:** The bulk of the 75-comment review thread consisted of inline code-review comments by @nabenabe0928 (variable naming, docstrings explaining the `deterministic` flag, tolerance values) whose verbatim text is lazy-loaded on the conversation page and was not retrievable via web fetch without the API. The author's verbatim top-level comments are quoted above.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
