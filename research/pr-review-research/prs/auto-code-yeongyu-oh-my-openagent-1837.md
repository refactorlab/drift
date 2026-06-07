# code-yeongyu/oh-my-openagent #1837 — feat: OpenCode beta SQLite migration compatibility

**[View PR on GitHub](https://github.com/code-yeongyu/oh-my-openagent/pull/1837)**

| | |
|---|---|
| **Author** | @code-yeongyu |
| **Status** | ✅ merged |
| **Opened** | 2026-02-14 |
| **Repo importance** | ★61,138 · 4,947 forks · score 85,924 |
| **Diff** | +3540 / −835 across 111 files |
| **Engagement** | 27 conversation · 47 inline review comments |

## Top review comments (ranked by reactions)

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1837#issuecomment-3904636024)

> @cubic-dev-ai re-review please. All P2 issues from previous reviews have been addressed:
> 
> 1. **session-utils.ts** - Added error logging to catch block (was silent swallow)
> 2. **opencode-message-dir.ts** - Fixed indentation, structured error logging
> 3. **storage.ts sessionExists** - Now uses `session.list()` to check existence (handles empty sessions correctly)
> 4. **storage.test.ts** - Uses `resetStorageClient()` for proper SDK client cleanup
> 5. **todo-sync.ts** - Added content-based fallback for removing id-less todos in `syncAllTasksToTodos`
> 6. **tool-result-storage.ts** - Already had `hasLoggedTruncateWarning` guard (log-once pattern)

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1837#issuecomment-3904657429)

> @cubic-dev-ai re-review. Addressed all 3 P2 issues from previous review:
> 1. target-token-truncation: Eliminated redundant SDK fetch - now extracts tool results from already-fetched data
> 2. recover-thinking-block-order: Added try/catch guards around SDK message fetches
> 3. thinking-strip: Added part.id guard before deletePart calls

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1837#issuecomment-3904668322)

> @cubic-dev-ai The 3 issues you found have been fixed in commit a4f67b0c (pushed before your review completed). Please re-review the latest state.

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1837#issuecomment-3904694663)

> @cubic-dev-ai Both issues from your 4/5 review have been addressed:
> 1. **P2 (URL encoding)**: Added `encodeURIComponent` to all path segments in `opencode-http-api.ts` (commit 12006c60)
> 2. **P3 (dead code)**: Restored `readMessagesFromSDK` and its test — the function has different return types from local implementations so cannot be wired up, but it's a tested utility (commit 5ff2dca9)
> 
> Please re-review.

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1837#issuecomment-3904723151)

> @cubic-dev-ai The P2 issue at empty-content-recovery-sdk.ts:35 was already fixed in commit 6ed3cc19 — `return true` is restored. This was reverted in the latest commit specifically to address your feedback. Please re-review against the HEAD commit.

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1837#issuecomment-3906583530)

> @cubic-dev-ai All 21 review threads are resolved. Please re-review and approve if everything looks good.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
