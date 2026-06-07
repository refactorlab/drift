# scikit-learn/scikit-learn #32644 — FEA Add array API support for LogisticRegression with LBFGS

**[View PR on GitHub](https://github.com/scikit-learn/scikit-learn/pull/32644)**

| | |
|---|---|
| **Author** | @OmarManzoor |
| **Status** | Merged (February 12, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ogrisel
> Could you also please profile a run using mps or cuda using py-spy?

### @ogrisel
> If the conversion of the raw predictions / pointwise gradients are significant, I think we should try to implement an alternative to the Cython gradient function using the array API to skip those conversions directly as part of this PR.

### @lorentzenchr
> Could provide a simple %time difference on a small dataset on numpy: main vs this PR. I am interested in the overhead incurred by this PR.

### @ogrisel
> It's nice to get a speed-up with CUDA besides the conversion of the raw predictions and pointwise gradient values of the loss at each iteration.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
