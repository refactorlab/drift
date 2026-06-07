# microsoft/LightGBM #6651 — [python-package] require `scikit-learn>=0.24.2`, make scikit-learn estimators compatible with `scikit-learn>=1.6.0dev`

**[View PR on GitHub](https://github.com/microsoft/LightGBM/pull/6651)**

| | |
|---|---|
| **Author** | @vnherdeiro |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jameslamb
> I think we should **leave `_more_tags()` untouched** and **add `__sklearn_tags__()`**. And have `self.__sklearn_tags__()` call `self._more_tags()` to get its data

### @adrinjalali
> note that it's possible already to support both with this method...however, the version check and `@available_if` are going to be unnecessary once we merge scikit-learn/scikit-learn#29801

### @StrikerRUS
> Adds `ensure_min_samples=ensure_min_samples,`

### @jameslamb
> I intentionally omitted `ensure_min_samples`. It's already not being passed in the one place it's used...this call to `check_array()` only happens in `predict()`, so we should avoid any more validation than absolutely necessary

### @StrikerRUS
> However, I think you should be aware that the default argument is `1`, not `None`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
