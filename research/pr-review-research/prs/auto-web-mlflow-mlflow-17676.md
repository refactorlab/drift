# mlflow/mlflow #17676 — Job execution backend

**[View PR on GitHub](https://github.com/mlflow/mlflow/pull/17676)**

| | |
|---|---|
| **Author** | @WeichenXu123 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dbczumar
> Does this include exceptions from within Huey itself (e.g. if Huey throws an exception due to a transient failure)? Ideally, it would be nice if this only included errors in job code.

### @dbczumar
> How do we retry failed jobs? is this handled by Huey?

### @WeichenXu123
> rethinking on this, I updated code to allow user to explicit raise `TransientError` in custom job function, so that each custom job function can have its own logic for transient errors.

### @harupy
> let's create a temp CI job and run this test module > 30 times to ensure it's not flaky. We can remove the job after that.

### @harupy
> We need to wait for the process to be killed, right?

### @dbczumar
> LGTM! I used the `submit_job` function to build GenAI monitoring in the MLflow server, and I'll file PRs for it soon.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
