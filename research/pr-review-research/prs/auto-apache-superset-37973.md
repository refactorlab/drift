# apache/superset #37973 — feat(api-keys): add API key authentication via FAB SecurityManager

**[View PR on GitHub](https://github.com/apache/superset/pull/37973)**

| | |
|---|---|
| **Author** | @aminghadersohi |
| **Status** | ✅ merged |
| **Opened** | 2026-02-14 |
| **Repo importance** | ★73,183 · 17,524 forks · score 148,279 |
| **Diff** | +779 / −12 across 11 files |
| **Engagement** | 36 conversation · 92 inline review comments |

## Top review comments (ranked by reactions)

### @aminghadersohi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/37973#issuecomment-3900609538)

> Addressed all review feedback in d65327189a:
> 
> **Fixed:**
> - **Clipboard error handling** (CodeAnt): `handleCopyKey` is now `async` with `try/catch` — shows a danger toast on clipboard failure instead of silently showing "Copied!" on an unhandled promise rejection.
> - **`has_request_context()` guard** (CodeAnt): API key extraction now only runs when there's an actual HTTP request context, preventing `RuntimeError` in MCP internal operations (tool discovery, etc.) that run with only an application context.
> - **`handleClose` ordering** (Bito): Moved `onSuccess()` call before state clearing. While React closures mean the original code wasn't technically buggy (`createdKey` retains its value in the closure), the new ordering is clearer about intent.
> - **antd Tag components** (Bito): Replaced custom styled `<span>` elements with antd `<Tag color="error|warning|success">` components for status badges, following Superset's convention of preferring antd components over custom CSS.
> 
> **Acknowledged (no change needed):**
> - **Supply chain risk** (Bito): The git URL dependency on FAB is temporary during development. Will revert to a standard PyPI version pin once [FAB PR #2431](https://github.com/dpgaspar/Flask-AppBuilder/pull/2431) is merged and released.
> - **Truncate key prefix** (Bito): The `key_prefix` column is already limited to 16 chars in the database schema, so no truncation is needed in the UI.
> - **Specify locale** (Bito): Using `undefined` locale in `toLocaleDateString()` is intentional — it uses the user's browser locale, which is the correct behavior for an internationalized a … *[truncated]*

### @aminghadersohi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/37973#issuecomment-3923421051)

> **Note on CI failures**: The 2 red checks (`check-python-deps` and `docker-build (lean)`) are expected and temporary. Both are caused by the git dependency on the [FAB feature branch](https://github.com/dpgaspar/Flask-AppBuilder/pull/2431):
> 
> - `check-python-deps` — CI re-compiles from `pyproject.toml` and resolves to `flask-appbuilder==5.1.0` (PyPI), which doesn't match our git ref
> - `docker-build (lean)` — The lean Docker image doesn't have `git` installed, so it can't clone the git dependency
> 
> Both will resolve once the FAB PR is merged and released to PyPI. All other 68 checks pass.

### @aminghadersohi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/37973#issuecomment-3998682965)

> > LGTM! I think you also need a code owner stamp though
> 
> Thank you for your time doing the review. Much appreciated. Hope to be able to return the favor in the future.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
