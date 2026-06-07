# apache/superset #37973 — feat(api-keys): add API key authentication via FAB SecurityManager

**[View PR on GitHub](https://github.com/apache/superset/pull/37973)**

| | |
|---|---|
| **Author** | @aminghadersohi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aminghadersohi
> The git URL dependency on FAB is temporary during development. Will revert to a standard PyPI version pin once FAB PR #2431 is merged and released.

### @msyavuz
> Looks good aside from small nits. Great feature to have!

### @aminghadersohi (architectural rationale)
> API key auth is implemented at the **Flask-AppBuilder layer** so the `@protect()` decorator handles it automatically — zero changes needed in individual API views.

### @bito-code-review
> The `handleClose` function sets createdKey to null before checking its value, which prevents onSuccess from being called after successful API key creation.

### @aminghadersohi (CI status clarification)
> Both are caused by the git dependency on the FAB feature branch... Both will resolve once the FAB PR is merged and released to PyPI.

### @bito-code-review
> Replace custom spans with antd Tags… Use antd Tag components for status badges to avoid custom CSS and follow best practices.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
