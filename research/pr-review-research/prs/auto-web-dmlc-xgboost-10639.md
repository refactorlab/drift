# dmlc/xgboost #10639 — [jvm-packages] [breaking] rework xgboost4j-spark and xgboost4j-spark-gpu

**[View PR on GitHub](https://github.com/dmlc/xgboost/pull/10639)**

| | |
|---|---|
| **Author** | @wbo4958 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @trivialfis
> For breaking changes PR, I am mostly concerned about the user interface, hence the request for documentation: How does the service loader work...What are the necessary changes from users, can we submit deprecation warnings...

### @hcho3
> CPU users will complain about the size of xgboost4j package if we choose this route [of including CUDA variants].

### @trivialfis
> What are the removed ETL, how does it change user's code. What migration guide is needed. What are the upcoming changes.

### @eordentlich
> Still have more to go through but here are a batch of comments (some questions).

### @jinmfeng
> For ranking task, the library should make sure records with the same group column go to the same task, otherwise it will impact model performance...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
