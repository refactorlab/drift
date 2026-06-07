# mlflow/mlflow #13276 — Make spark_udf support Databricks Serverless, Databricks connect, and prebuilt python environment

**[View PR on GitHub](https://github.com/mlflow/mlflow/pull/13276)**

| | |
|---|---|
| **Author** | @WeichenXu123 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @harupy
> LGTM to unblock. Let's make sure we can easily migrate away from the current approach if a better solution is found.

### @BenWilson2
> Tiny nits. LGTM once they're addressed. We should follow up with: 1. Utility API for simplifying the use of this functionality. 2. Add a section that walks through how to use this functionality...

### @harupy (inline review threads)
> Requested changes to docstring clarity and example code structure across multiple review rounds, focusing on documentation completeness. (Inline thread prose was not fully rendered verbatim on the web conversation page.)

### @BenWilson2 (documentation guidance)
> Emphasized need for end-to-end examples and clear documentation of restrictions mentioned in docstrings within the main MLflow models documentation. (Inline thread prose was not fully rendered verbatim on the web conversation page.)

### @harupy (code quality review)
> Multiple rounds of review addressing formatting, API consistency, and example accuracy before final approval. (Inline thread prose was not fully rendered verbatim on the web conversation page.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
