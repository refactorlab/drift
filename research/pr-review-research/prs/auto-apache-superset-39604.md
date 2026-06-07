# apache/superset #39604 — fix(mcp): API key authentication for MCP — transport, validation, and RBAC

**[View PR on GitHub](https://github.com/apache/superset/pull/39604)**

| | |
|---|---|
| **Author** | @aminghadersohi |
| **Status** | ✅ merged |
| **Opened** | 2026-04-23 |
| **Repo importance** | ★73,183 · 17,524 forks · score 148,279 |
| **Diff** | +1461 / −301 across 14 files |
| **Engagement** | 18 conversation · 116 inline review comments |

## Top review comments (ranked by reactions)

### @aminghadersohi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/39604#issuecomment-4309510637)

> Addressed all review comments in the latest commit:
> 
> **CodeQL (clear-text logging):** False positive — the log line logs `FAB_API_KEY_PREFIXES` (e.g. `["sst_"]`), which are configuration values/prefixes, not actual API keys or passwords. No sensitive data is exposed.
> 
> **codeant-ai (type annotations):** Added explicit type annotations to all new test function parameters and fixture return types across both test files. Fixtures now have return type annotations (`-> MagicMock`, `-> CompositeTokenVerifier`) and test functions annotate their fixture parameters (`app: SupersetApp`, `composite_verifier: CompositeTokenVerifier`, `mock_jwt_verifier: MagicMock`).

### @aminghadersohi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/39604#issuecomment-4381227923)

> ## Review: `CompositeTokenVerifier` scope handling
> 
> Two findings from digging into the FastMCP internals:
> 
> ### 🔴 Bug: pass-through tokens will 403 when `MCP_JWT_REQUIRED_SCOPES` is set
> 
> There are two independent scope enforcement layers in FastMCP:
> 
> 1. **Inside `verify_token()`** — `JWTVerifier.load_access_token()` (`providers/jwt.py:463-473`) checks `required_scopes` before returning. The composite bypasses this for API key tokens — fine.
> 2. **Transport middleware** — `RequireAuthMiddleware.__call__()` (`bearer_auth.py:78-96`) independently checks each required scope against `AuthCredentials(auth_info.scopes)`. The pass-through `AccessToken` has `scopes=[]`, so this check **will 403 every API key request** when `MCP_JWT_REQUIRED_SCOPES` is non-empty.
> 
> Fix: populate `scopes` from `self.required_scopes` on the pass-through token so the middleware is satisfied while `_api_key_passthrough` still tells `_resolve_user_from_jwt_context` to defer:
> 
> ```python
> # composite_token_verifier.py
> return AccessToken(
>     token=token,
>     client_id="api_key",
>     scopes=list(self.required_scopes),  # satisfy RequireAuthMiddleware
>     claims={"_api_key_passthrough": True},
> )
> ```
> 
> ### 🟡 Minor: `_api_key_passthrough` claim name collision
> 
> A JWT issued by an external IdP that happens to include `{"_api_key_passthrough": true}` as a custom claim would be silently misidentified in `_resolve_user_from_jwt_context` and cause auth failure. Not an auth bypass, but a subtle footgun. Consider a namespaced sentinel like `_superset_mcp_api_key_passthrough` or keying off `client_id == "api_key"` instead. … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
