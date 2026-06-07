# mlflow/mlflow #22145 — Add AI Gateway benchmark suite

**[View PR on GitHub](https://github.com/mlflow/mlflow/pull/22145)**

| | |
|---|---|
| **Author** | @PattaraS |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @TomeHirata
> Can we make the port configurable?

### @TomeHirata
> Why do we use gunicorn here? Wasn't uvicorn sufficient?

### @TomeHirata
> Do we need legacy completions?

### @TomeHirata
> do we need embeddings?

### @TomeHirata
> why do users need UV_NO_SOURCES=1?

### Copilot AI (automated review)
> The fake OpenAI server is bound to 0.0.0.0 by default...Prefer binding to 127.0.0.1

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
