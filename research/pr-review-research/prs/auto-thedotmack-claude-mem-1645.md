# thedotmack/claude-mem #1645 — fix(mcp): MCP server crashes with Cannot find module 'bun:sqlite' under Node

**[View PR on GitHub](https://github.com/thedotmack/claude-mem/pull/1645)**

| | |
|---|---|
| **Author** | @thedotmack |
| **Status** | ✅ merged |
| **Opened** | 2026-04-07 |
| **Repo importance** | ★80,782 · 6,949 forks · score 113,548 |
| **Diff** | +770 / −2279 across 9 files |
| **Engagement** | 36 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @thedotmack — 1 reactions  
`👀 1`  ·  [link](https://github.com/thedotmack/claude-mem/pull/1645#issuecomment-4202786030)

> @coderabbitai review
> 
> The two issues from your previous review have both been addressed:
> 
> 1. **mkdir-before-writeFileSync** in 5e3b4e14 — `markWorkerSpawnAttempted` now calls `mkdirSync(path.dirname(lockPath), { recursive: true })` before `writeFileSync` so a fresh user profile without `~/.claude-mem/` won't silently fail to create the cooldown marker.
> 
> 2. **APPROVED OVERRIDE annotations** in 4fb6ed51 — both `markWorkerSpawnAttempted` and `clearWorkerSpawnAttempted` now carry `APPROVED OVERRIDE` comments matching the convention in `ProcessManager.ts:689`, `BaseRouteHandler.ts:82`, and `ChromaSync.ts:288`.
> 
> CI is green on the latest commit (4fb6ed51). Please re-review and update your verdict if everything looks good.

### @thedotmack — 1 reactions  
`👀 1`  ·  [link](https://github.com/thedotmack/claude-mem/pull/1645#issuecomment-4202819872)

> **Round 2 review feedback addressed in 7a96b3b9.** Thanks to the three review passes — here's the disposition:
> 
> **Build guardrail (most important):**
> - ✅ `scripts/build-hooks.js` now post-build greps `mcp-server.cjs` for `bun:sqlite` and fails the build if found. This protects the exact regression PR #1645 fixes — future contributors get an immediate signal if a transitive import re-introduces the SQLite chain. Verified the check trips when the bundle is doctored.
> 
> **Code clarity:**
> - ✅ Dropped dead `_originalLog` capture in `mcp-server.ts`.
> - ✅ Elevated the `cwd()` fallback log from WARN to ERROR — a wrong `WORKER_SCRIPT_PATH` means silent auto-start failure, so the breadcrumb should be loud.
> - ✅ Extended doc comment on the `worker-service.ts` wrapper explaining why `__filename` is the correct script path (CJS bundle = compiled worker-service.cjs) and why mcp-server.ts can't use the same trick.
> - ✅ Inline comment on the `env.BUN === 'bun'` bare-command guard in `resolveWorkerRuntimePath`.
> 
> **Coverage:**
> - ✅ Added `/usr/bin/bun` to Linux candidate paths (Debian/Ubuntu apt install).
> 
> **Already verified before round 1, restating for the record:**
> - ✅ `null` return from `resolveWorkerRuntimePath` is handled — `spawnDaemon` Unix branch checks `if (!unixRuntimePath)` and returns undefined, so callers get the same "failed to spawn" path as a real spawn failure.
> - ✅ Windows `0` PID sentinel — already documented in commit 5c2fb304 with a comment explaining the `pid === undefined` contract.
> - ✅ `markWorkerSpawnAttempted` mkdir fix is documented in the round-1 commit message and roun … *[truncated]*

### @thedotmack — 1 reactions  
`👀 1`  ·  [link](https://github.com/thedotmack/claude-mem/pull/1645#issuecomment-4202850607)

> **Round 3 review feedback addressed in 193286f9.**
> 
> **Code changes:**
> - ✅ Improved `spawnDaemon` error messages on both Windows and Unix branches: now name the install URL and explain *why* Bun is required (worker uses `bun:sqlite`). The existing null-guard at the call sites already prevented passing `null` to `child_process.spawn`; only the error text changed.
> - ✅ Refined the build-time `bun:sqlite` guardrail to match actual `require("bun:sqlite")` calls only (regex), not arbitrary mentions in string literals. This was necessary because my new error message above legitimately mentions "bun:sqlite" by name. Verified the regex still trips on real violations (spaced and minified) and correctly ignores string-literal references.
> 
> **Verified, no change needed:**
> - `TOOL_ENDPOINT_MAP` — flagged as dead code, but it IS used at `mcp-server.ts:250` (`search` handler) and `:263` (`timeline` handler). False positive.
> - `if (!pid)` callsites — grepped `src/`, zero offenders. The Windows `0` PID sentinel contract is safe.
> - `callWorkerAPIPost` double-wrapping — pre-existing intentional behavior. Only used by `/api/observations/batch`, which returns raw data (not the MCP `{content:[...]}` shape), so wrapping is correct. Unrelated to this regression.
> 
> **Deferred (consistent with previous rounds):**
> - Test for non-existent `workerScriptPath` — needs injectable I/O, follows from the broader cooldown-helper test gap.
> - Snap path / `startParentHeartbeat` Windows comment / `main().catch` exit-0 commentary — out of scope, pre-existing or unrelated.
> 
> CI will fire for the new commit. @coderabbit … *[truncated]*

### @thedotmack — 1 reactions  
`👀 1`  ·  [link](https://github.com/thedotmack/claude-mem/pull/1645#issuecomment-4202863463)

> **Round 4 nitpick addressed in d47ac77d.**
> 
> Added a contract test `Windows 0 PID success sentinel must NOT be detected via falsy check` to `tests/infrastructure/process-manager.test.ts`. The test deliberately exercises the JS-level semantics rather than mocking PowerShell — a true mocked Windows test would require refactoring `spawnDaemon` to take an injectable `execSync`, which is a larger change than this hotfix should carry. The contract assertions catch the same regression class (treating Windows success as failure) without that refactor.
> 
> Test count: 44/44 (was 43/43).
> 
> CI will fire for the new commit. @coderabbitai please re-review.

### @thedotmack — 0 reactions  
`—`  ·  [link](https://github.com/thedotmack/claude-mem/pull/1645#issuecomment-4202878154)

> **Round 4 review feedback addressed in b2c114b4.**
> 
> Two minor items from claude-review of round 3:
> - ✅ Replaced `require('fs')` with the already-imported `statSync` in `tests/infrastructure/process-manager.test.ts` (touchPidFile test). Two call sites updated.
> - ✅ Hoisted `resolveWorkerRuntimePath()` + the "Bun runtime not found" error handling out of both branches in `spawnDaemon`. Single resolve before the OS branch split → no duplicate `execSync('which bun')` if Bun isn't found at a well-known path, and the error message is DRY now.
> 
> CodeRabbit already confirmed in its previous reply that all four rounds are resolved on its end. Tests still 44/44, build still clean, mcp-server.cjs still has zero `require("bun:sqlite")` calls.
> 
> The PR's `reviewDecision` is currently still `CHANGES_REQUESTED` because GitHub doesn't auto-clear CodeRabbit's original review. Per CodeRabbit's own response: "CodeRabbit is an incremental review system and does not re-review already reviewed commits" — so the only way to clear that state is for CodeRabbit to re-evaluate against the latest commit (which it should do automatically on push) or for a maintainer to dismiss the stale review.

### @thedotmack — 0 reactions  
`—`  ·  [link](https://github.com/thedotmack/claude-mem/pull/1645#issuecomment-4202894740)

> **Round 5 review feedback addressed in 3570d2f0.**
> 
> - ✅ Dropped `export` from `shouldSkipSpawnOnWindows`/`markWorkerSpawnAttempted`/`clearWorkerSpawnAttempted` in `worker-spawner.ts` — they were exported but only used internally, narrowing the public surface to just `ensureWorkerStarted`.
> - ✅ Broadened the build guardrail to catch any `require("bun:*")` import, not just `bun:sqlite`. Verified the new regex still trips on `bun:sqlite`, `bun:ffi`, `bun:test` and correctly ignores string-literal mentions in error messages.
> - ✅ Improved dual-failure messaging in `mcp-server.ts`: when `__dirname`/`import.meta.url` resolution fails AND the resulting WORKER_SCRIPT_PATH doesn't exist, the existence-check branch now emits a single root-cause-attributing error instead of a confusing "missing worker bundle" warning that would hide the dirname-resolution failure.
> 
> **Already addressed in earlier rounds (these reviews predate the round-4 commit):**
> - `resolveWorkerRuntimePath()` called twice in `spawnDaemon` — hoisted to a single call before the OS branch in b2c114b4 (round 4)
> - `_originalLog` dead code — removed in 7a96b3b9 (round 2)
> - `require('fs')` in test — replaced with `statSync` import in b2c114b4 (round 4)
> 
> **Out of scope (consistent disposition):**
> - darwin/linux candidate split — benign today
> - Integration test for non-existent `workerScriptPath` — needs injectable I/O refactor
> - Deferring `existsSync` to first call — current module-init check is the loud signal we want for partial-install scenarios
> 
> Build: ✅ clean. Tests: 44/44. MCP smoke test: 7-tool surface intact.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
