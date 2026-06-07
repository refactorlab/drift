# streamlit/streamlit #14972 — [feature] Add custom script error handling via `st.App`

**[View PR on GitHub](https://github.com/streamlit/streamlit/pull/14972)**

| | |
|---|---|
| **Author** | @lukasmasuch |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @greptile-apps
> Fragment exceptions silently bypass the handler despite the spec explicitly listing them as in-scope, which would surprise users wiring up error monitoring

### @github-actions
> Fix StopException/RerunException from handler: Now properly caught and logged instead of re-raised, preventing script-runner thread crashes

### @github-actions
> De-duplicate the handler-invocation block in exec_code.py and fragment.py into a single helper to prevent further drift

### @github-actions
> The OnScriptErrorHandler alias is defined only under TYPE_CHECKING, but it is referenced in runtime-visible annotations...with PEP 649 signature inspection (Python 3.14) will fail to resolve the alias

### @lukasmasuch
> Addressed all major concerns through iterative commits, including centralizing handler invocation and routing fragment exceptions through the callback.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
