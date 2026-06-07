# BerriAI/litellm #22923 — fix(sso): direct PKCE token exchange + Redis wiring for multi-instance SSO

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/22923)**

| | |
|---|---|
| **Author** | @ishaan-jaff |
| **Status** | Merged (Mar 12, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: The substantive technical review on this PR was delivered by the Greptile automated reviewer; the human maintainers acted on its findings. The most teaching-rich items are quoted verbatim below.

### @greptile-apps (dead code detection)
> response is initialized to None...If AsyncClient() construction fails, the exception propagates immediately without entering the block body, leaving response = None...The guard at lines 2820–2827 cannot be reached in practice

### @greptile-apps (cache cleanup gap)
> Stale empty-valued cache entry is never cleaned up in non-strict mode...when code_verifier is falsy, the cache key is not returned to the caller, so _delete_pkce_verifier is never called

### @greptile-apps (test mock issue)
> Missing async mock setup causes silent cleanup failure in test...Since the mock doesn't provide an awaitable, a TypeError is raised and silently caught by the exception handler — meaning the cleanup path never actually executes

### @greptile-apps (bearer credential merge logic)
> The comment states credentials must come from token endpoint...but Case 3 explicitly accepts these fields from userinfo when absent from token_response

### @greptile-apps (test assertion weakness)
> redirect_uri not asserted in POST body...accidentally removing that guard would silently omit redirect_uri from the POST body — and many OAuth providers reject requests

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
