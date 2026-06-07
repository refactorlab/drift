# optuna/optuna #5185 — Add GPSampler

**[View PR on GitHub](https://github.com/optuna/optuna/pull/5185)**

| | |
|---|---|
| **Author** | @contramundum53 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @contramundum53
> Gaussian process-based bayesian optimization has been a famous and standard bayesian optimization algorithm for long, yet Optuna has only supported it through `optuna.integration.BoTorchSampler`.

### @contramundum53
> BoTorch is a pretty complex library, has a long list of dependency that easily conflicts with the users' environment, and its dependency is not stable across updates.

### @contramundum53
> BoTorchSampler only uses the simplest features of BoTorch, so it might not be worth paying for its abstraction.

### @nabenabe0928
> Btw, I did not pay attention, but how do we handle `inf`, `-inf`, `None`, and `nan`?

### @contramundum53
> We don't and cannot handle them, I think. Neither does `BoTorchSampler`.

### @contramundum53
> I clamped inf values to current worst/best values.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
