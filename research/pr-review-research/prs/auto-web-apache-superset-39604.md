# apache/superset #39604 — fix(mcp): API key authentication for MCP — transport, validation, and RBAC

**[View PR on GitHub](https://github.com/apache/superset/pull/39604)**

| | |
|---|---|
| **Author** | @aminghadersohi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dpgaspar
Requested that the ApiKey view-menu guard be moved from the static `ADMIN_ONLY_VIEW_MENUS` into `_is_admin_only`, so enforcement only occurs when `FAB_API_KEY_ENABLED=True` (conditional permission logic).

### @aminghadersohi (self-review)
Identified that pass-through tokens would receive 403 errors when `MCP_JWT_REQUIRED_SCOPES` was set, requiring scopes to be populated from `self.required_scopes` on the token to satisfy middleware checks.

### @aminghadersohi (self-review)
Flagged a claim-name collision risk: an external IdP JWT containing `_api_key_passthrough` as a custom claim could cause misidentification, suggesting namespacing like `_superset_mcp_api_key_passthrough`.

### @bito-code-review
Suggested strengthening a test assertion from `assert_awaited_once()` to `assert_awaited_once_with("not_a_valid_token")` to verify the correct token argument was passed.

### @Copilot
Noted that `_resolve_user_from_api_key` reading from the FastMCP `AccessToken` instead of Flask request headers fixes the security gap where invalid Bearer tokens fell through to weaker auth sources.

### @bito-code-review
Flagged (post-merge) that the no-app pass-through branch should redact the raw API key before returning the `AccessToken`, to avoid retaining secrets in memory.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
