# microsoft/LightGBM #6857 — [python-package] scikit-learn fit() methods: add eval_X, eval_y, deprecate eval_set

**[View PR on GitHub](https://github.com/microsoft/LightGBM/pull/6857)**

| | |
|---|---|
| **Author** | @lorentzenchr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jameslamb
> Making both options available for a time and raising a deprecation warning when `eval_set` if non-empty seems fine to me...I'd also support a runtime **error** when both `eval_set` and `eval_X` are non-empty, to avoid taking on the complexity of merging those 2 inputs.

### @jameslamb
> Removing `eval_set` from LightGBM's `scikit-learn` estimators would be highly disruptive and requires a long deprecation cycle (more than a year, in my opinion).

### @StrikerRUS
> I believe that `deprecated` directive will suit better

### @jameslamb
> Added this check on the validation results. Just checking the predicted values is not sufficient to test that the passed validation sets were actually used

### @jameslamb
> Expanded these tests so they could catch more possible bugs, like: one of the validation sets was ignored [or] the same validation set was referenced multiple times

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
