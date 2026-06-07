# scikit-learn/scikit-learn #32644 — FEA Add array API support for LogisticRegression with LBFGS

**[View PR on GitHub](https://github.com/scikit-learn/scikit-learn/pull/32644)**

| | |
|---|---|
| **Author** | @OmarManzoor |
| **Status** | ✅ merged |
| **Opened** | 2025-11-04 |
| **Repo** | curated review-culture seed |
| **Diff** | +893 / −91 across 17 files |
| **Engagement** | 48 conversation · 201 inline review comments |

## Top review comments (ranked by reactions)

### @ogrisel — 2 reactions  
`👍 2`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32644#issuecomment-3492548241)

> I pushed 231d804 because I have the feeling that upcasting to float64 is useless: this is a change of behavior but I have the feeling that this is an improvement (to get speed and reduce memory usage). I think it should be documented as such in the changelog. Users who want the numerical precision of operating with float64 feature values can always cast their input array explicitly.

### @betatim — 2 reactions  
`👍 2`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32644#issuecomment-3542150218)

> I think seeing (quite) different speed ups depending on which combination of CPU and GPU you use is expected. Or at least not too surprising. For me the precise speed up is less important than seeing a general trend. It seems we see speed improvements across different CPU/GPU combinations and also different choices for `n_samples` and `n_features` (we don't have to cherry pick any to demonstrate a speed up).

### @OmarManzoor — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32644#issuecomment-3496544058)

> > I think this PR is starting to look great. Two things we might consider doing as part of this before moving it out of draft:
> > 
> > * also update `LogisticRegressionCV` to add support for array API when `solver="lbfgs"` (should be straightforward);
> > * try to avoid the NumPy conversion for the point-wise gradient computation by providing an array API compatible alternative for the multinomial loss.
> > 
> > @OmarManzoor do you agree with this plan or would you prefer to address those as part of follow-up PRs and review the current PR as it is?
> 
> I think it might make sense to have follow up PRs to address these two items but maybe we can try adding `LogisticRegressionCV` in this same PR and have a dedicated follow up PR to refactor the required loss functions (mainly `loss_gradient`)

### @OmarManzoor — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32644#issuecomment-3501684809)

> After starting work on `LogisticRegressionCV` I feel it might require some work to get it functional properly as there are functions like `np.swapaxes` that will need to be added in the utils since they are neither supported by the array api specification nor by `array-api-extra`. Moreover classification metrics might also need to be accommodated to handle the policy of `y_true` can follow the namespace and device of `y_pred` which I think is not handled right now. So it might be better to work on `LogisticRegressionCV` in a dedicated PR (maybe even create a new issue (ticket) specifically for it).
> 
> We might be able to go with the following plan:
> 
> - Finalize the current PR and merge it.
> - As an immediate follow up, add the required refactoring in the `loss_gradient` functions of the private `loss` module to avoid back and forth conversions to numpy in `linear_loss.py`
> - Start work on `LogisticRegressionCV`, maybe create a dedicated issue (ticket) for this.

### @OmarManzoor — 1 reactions  
`🎉 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32644#issuecomment-3512245845)

> I tried implementing the array API versions of the required `loss` module methods and for the multi class case we can get quite significant speedups:
> 
> ### Multi Class benchmarks
> 
> <Details>
> 
> ```python
> from time import time
> 
> import numpy as np
> import torch as xp
> from tqdm import tqdm
> 
> from sklearn import config_context
> from sklearn.linear_model import LogisticRegression
> 
> n_samples, n_features, n_classes = 100000, 1000, 50
> device = "cuda"
> n_iter = 10
> 
> X_np = np.random.rand(n_samples, n_features)
> y_np = np.random.randint(0, n_classes, n_samples)
> numpy_fit_times = []
> numpy_predict_times = []
> for _ in tqdm(range(n_iter), desc="Numpy"):
>     lr = LogisticRegression(C=0.8, solver="lbfgs", max_iter=200)
>     start = time()
>     lr.fit(X_np, y_np)
>     numpy_fit_times.append(round(time() - start, 3))
>     start = time()
>     pred = lr.predict_proba(X_np)
>     numpy_predict_times.append(round(time() - start, 3))
> 
> avg_numpy_fit = round(sum(numpy_fit_times) / n_iter, 3)
> avg_numpy_predict = round(sum(numpy_predict_times) / n_iter, 3)
> 
> torch_fit_times = []
> torch_predict_times = []
> X_xp = xp.rand((n_samples, n_features), device=device)
> y_xp = xp.randint(0, n_classes, (n_samples,), device=device)
> for _ in tqdm(range(n_iter), desc=f"Torch {device}"):
>     with config_context(array_api_dispatch=True):
>         lr = LogisticRegression(C=0.8, solver="lbfgs", max_iter=200)
>         start = time()
>         lr.fit(X_xp, y_xp)
>         torch_fit_times.append(round(time() - start, 3))
>         start = time()
>         pred = lr.predict_proba(X_xp)
>         first = float(pred[0, 0])
>         torch_predict_times.appen … *[truncated]*

### @OmarManzoor — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32644#issuecomment-3512267525)

> @ogrisel What do you think should we push the changes in this PR? The files to be reviewed might increase but maybe then we would be able to complete `LogisticRegresssion`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
