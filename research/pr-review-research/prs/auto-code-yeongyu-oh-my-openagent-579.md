# code-yeongyu/oh-my-openagent #579 — [ORCHESTRATOR TEST] feat(auth): multi-account Google Antigravity auth with automatic rotation

**[View PR on GitHub](https://github.com/code-yeongyu/oh-my-openagent/pull/579)**

| | |
|---|---|
| **Author** | @code-yeongyu |
| **Status** | ✅ merged |
| **Opened** | 2026-01-07 |
| **Repo importance** | ★61,138 · 4,947 forks · score 85,924 |
| **Diff** | +3963 / −34 across 21 files |
| **Engagement** | 15 conversation · 69 inline review comments |

## Top review comments (ranked by reactions)

### @code-yeongyu — 1 reactions  
`👍 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/579#issuecomment-3719685731)

> ## Review Feedback Addressed
> 
> Fixed the 2 issues raised by Greptile:
> 
> 1. **Duplicate ManagedAccount interface** - Removed unused `ManagedAccount` interface from `types.ts` (lines 251-254). The real interface with runtime fields lives in `accounts.ts`.
> 
> 2. **Recursive fetch creates new closure** - Changed rate limit retry to reuse existing `fetchFn` instead of calling `createAntigravityFetch()`. This preserves:
>    - `cachedTokens` (cached auth state)
>    - `cachedProjectId` (cached project ID)
>    - `fetchInstanceId` (thought signature tracking)
>    - `accountsLoaded` flag
> 
> All 709 tests pass ✅
> 
> @greptile-apps please re-review

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/579#issuecomment-3719736019)

> ## Cubic Review Feedback Addressed (8 issues)
> 
> ### P1 Fixes (High Priority)
> 1. ✅ **storage.ts:47** - OAuth credentials now written with `mode: 0o600` (owner-only)
> 2. ✅ **fetch.ts:676** - Returns original 5xx status instead of synthesized 429
> 3. ✅ **accounts.ts:185** - `removeAccount()` now adjusts `activeIndex` and `currentIndex`
> 4. ✅ **plugin.ts:138** - Migration now splits on `|||` to preserve all accounts
> 
> ### P2 Fixes (Medium Priority)
> 5. ✅ **cli.ts:13** - Removed confusing cancel message when returning default value
> 6. ✅ **auth.ts:61** - Strict parseInt check (`Number.isInteger && String match`)
> 7. ✅ **storage.test.ts:62** - Environment cleanup wrapped in try/finally
> 
> All 709 tests pass ✅
> 
> @cubic-dev-ai please re-review

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/579#issuecomment-3721316537)

> ## Cubic Review Round 2 Addressed
> 
> Fixed all 5 issues from commit 76f6495 review:
> 
> 1. **P1: fetch.ts:685** - Return original 429/5xx response on last endpoint instead of generic 503
> 2. **P2: storage.ts:51** - Use unique temp filename (pid+timestamp) 
> 3. **P2: storage.ts:53** - Cleanup temp file on rename failure
> 4. **P2: fetch.ts:437** - Clear cachedProjectId when first account introduced
> 5. **P3: plugin.ts:343** - Add console.error logging to open() catch
> 
> All 54 auth tests pass ✅
> 
> @cubic-dev-ai please re-review

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/579#issuecomment-3721805736)

> ## Cubic Review Round 3 Addressed
> 
> Fixed all 4 issues from commit a2cb84c review:
> 
> 1. **P1: plugin.ts** - Validate `refresh_token` before constructing first account
> 2. **P1: plugin.ts** - Validate `additionalTokens.refresh_token` before pushing additional accounts  
> 3. **P1: fetch.ts** - Reset `cachedTokens` when switching accounts during rotation
> 4. **P2: fetch.ts** - Improve model-family detection (parse model from body, fallback to URL)
> 
> All 75 auth tests pass ✅
> 
> @cubic-dev-ai please re-review

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/579#issuecomment-3721815936)

> ## Cubic Review Round 4 Addressed
> 
> Fixed all 3 issues:
> 
> 1. **P1: plugin.ts** - Close `serverHandle` before early return on missing refresh_token
> 2. **P1: plugin.ts** - Close `additionalServerHandle` before continue on missing refresh_token
> 3. **P2: fetch.ts** - Remove overly broad 'pro' matching in `getModelFamilyFromModelName`
> 
> All 75 auth tests pass ✅
> 
> @cubic-dev-ai please re-review

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/579#issuecomment-3721847137)

> ## Cubic Review Round 5 Addressed
> 
> Fixed all 9 issues:
> 
> ### P1 Fixes
> 1. **plugin.ts** - Close `additionalServerHandle` after successful account auth
> 2. **fetch.ts** - Cancel response body on 429/5xx to prevent connection leaks
> 
> ### P2 Fixes
> 3. **plugin.ts** - Close `additionalServerHandle` on OAuth error/missing code
> 4. **plugin.ts** - Close `additionalServerHandle` on verifier mismatch
> 5. **auth.ts** - Set `activeIndex` to -1 when all accounts removed
> 6. **storage.ts** - Use shared `getDataDir` utility for consistent paths
> 7. **fetch.ts** - Catch `loadAccounts()` IO errors with graceful fallback
> 8. **storage.test.ts** - Improve test assertions with proper error tracking
> 
> All 75 auth tests pass ✅
> 
> @cubic-dev-ai please re-review


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
