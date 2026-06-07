# dmlc/xgboost #11166 — [doc] Reference the R doc in sphinx document site.

**[View PR on GitHub](https://github.com/dmlc/xgboost/pull/11166)**

| | |
|---|---|
| **Author** | @trivialfis |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @david-cortes
> Since the vignette is not being built through `R CMD`, it probably needs to install the generated artifact first, which should solve most of the errors. Either that, or load it through `devtools::load_all()`

### @david-cortes
> Title 'XGBoost R Package for Scalable GBM' doesn't quite give the impression that this is the documentation package for the R package.

### @david-cortes
> Looks like the pkgdown site is not rendering R equations correctly - could it be missing some plugin?

### @david-cortes
> I think it'd be helpful to have more levels. Especially for the python package docs.

### @trivialfis
> took me a while to figure out how it works and that the existing code was broken after the CI revamp. Would be great if we could use a package manager like conda to handle R packages instead of spawning out a new CI workflow.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
