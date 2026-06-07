# affaan-m/ECC #1367 — feat(hooks,skills): add gateguard fact-forcing pre-action gate

**[View PR on GitHub](https://github.com/affaan-m/ECC/pull/1367)**

| | |
|---|---|
| **Author** | @ozoz5 |
| **Status** | ✅ merged |
| **Opened** | 2026-04-12 |
| **Repo importance** | ★207,654 · 31,866 forks · score 340,113 |
| **Diff** | +846 / −0 across 4 files |
| **Engagement** | 22 conversation · 33 inline review comments |

## Top review comments (ranked by reactions)

### @ozoz5 — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/affaan-m/ECC/pull/1367#issuecomment-4234432993)

> All requested changes addressed across 4 commits:
> 
> **@affaan-m's blocking issues (3/3):**
> 1. State keyed by `CLAUDE_SESSION_ID` / `ECC_SESSION_ID` (falls back to `pid-{ppid}`)
> 2. Atomic write via temp file + `fs.renameSync`
> 3. Checked list capped at 500 entries, stale session files auto-pruned after 1 hour
> 
> **@greptile-apps P1 (1/1):**
> 4. MultiEdit now iterates `toolInput.edits[].file_path` instead of reading `toolInput.file_path`
> 
> **@cubic-dev-ai P1+P2 (2/2):**
> 5. Tests pass fixed `CLAUDE_SESSION_ID` to spawned hooks (no more PID mismatch)
> 6. Pruning preserves `__`-prefixed session keys (`__bash_session__` etc.)
> 
> **Additional fixes found during self-review (2):**
> 7. `isChecked()` no longer writes to disk (was causing 3x I/O per tool call)
> 8. Test cleanup uses `fs.rmSync(recursive)` instead of `fs.rmdirSync`
> 
> 9/9 tests pass. Ready for re-review.

### @affaan-m — 0 reactions  
`—`  ·  [link](https://github.com/affaan-m/ECC/pull/1367#issuecomment-4234717149)

> Pushed `2e44bea` to tighten the GateGuard test harness:
> 
> - uses a per-test temp state directory when `GATEGUARD_STATE_DIR` is not supplied
> - only recursively removes the directory when the test itself created it
> 
> That removes the real test cleanup hazard around externally supplied state directories without changing the hook runtime behavior.

### @affaan-m — 0 reactions  
`—`  ·  [link](https://github.com/affaan-m/ECC/pull/1367#issuecomment-4234742519)

> Pushed `6c67566` to address the remaining live GateGuard session-state issues:
> 
> - successful read checks now refresh `last_active`, so active sessions do not age out just because the hook only observed existing state
> - pruning now explicitly preserves `__bash_session__`, so a long destructive-command history does not accidentally re-trigger the routine Bash gate
> - added focused regressions covering both behaviors in `tests/hooks/gateguard-fact-force.test.js`
> 
> Focused validation run:
> - `node tests/hooks/gateguard-fact-force.test.js`


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
