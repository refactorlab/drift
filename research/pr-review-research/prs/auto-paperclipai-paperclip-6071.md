# paperclipai/paperclip #6071 — [codex] Add workspace diff viewer plugin

**[View PR on GitHub](https://github.com/paperclipai/paperclip/pull/6071)**

| | |
|---|---|
| **Author** | @cryppadotta |
| **Status** | ✅ merged |
| **Opened** | 2026-05-15 |
| **Repo importance** | ★69,213 · 12,841 forks · score 125,572 |
| **Diff** | +4118 / −70 across 48 files |
| **Engagement** | 16 conversation · 14 inline review comments |

## Top review comments (ranked by reactions)

### @cryppadotta — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/6071#issuecomment-4467189264)

> Refreshed in latest  push (HEAD: 986df210a).\n\nThis refresh includes the diff plugin generalization follow-up commits:
> - 56eb9a563 Generalize project workspace plugin tabs
> - 09ea87fb1 Replace plugin diff bridge with workspace metadata
> - ce6795803 Move workspace diff into plugin
> - c91fd1ede Humanize workspace diff error state
> - 1d26d33aa Handle missing workspace plugin tabs
> - abd68ef87 Set workspace diff tab order
> - 43c4abaf8 Cover plugin workspace heading state
> - 986df210a Fix workspace changes toolbar defaults\n\nValidation run (minimal scope):\n- pnpm --filter @paperclipai/plugin-workspace-diff test\n- pnpm --filter @paperclipai/shared typecheck\n- pnpm --filter @paperclipai/server exec vitest run src/__tests__/plugin-execution-workspace-bridge.test.ts src/__tests__/workspace-runtime-routes-authz.test.ts --testTimeout 30000\n\nAll three command sets passed in this refresh; no code changes since prior push.

### @cryppadotta — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/6071#issuecomment-4467190196)

> PR refresh completed on branch PAP-9406... (now at 986df210a).
> 
> Included in this refresh:
> - 56eb9a563 Generalize project workspace plugin tabs
> - 09ea87fb Replace plugin diff bridge with workspace metadata
> - ce6795803 Move workspace diff into plugin
> - c91fd1ede Humanize workspace diff error state
> - 1d26d33aa Handle missing workspace plugin tabs
> - abd68ef87 Set workspace diff tab order
> - 43c4abaf8 Cover plugin workspace heading state
> - 986df210a Fix workspace changes toolbar defaults
> 
> Validation reran successfully (minimal scope):
> - pnpm --filter @paperclipai/plugin-workspace-diff test
> - pnpm --filter @paperclipai/shared typecheck
> - pnpm --filter @paperclipai/server exec vitest run src/__tests__/plugin-execution-workspace-bridge.test.ts src/__tests__/workspace-runtime-routes-authz.test.ts --testTimeout 30000
> 
> Open tasks still pending in PR lifecycle are reviewer follow-ups only; code changes from generalization are now in branch and pushed.

### @cryppadotta — 0 reactions  
`—`  ·  [link](https://github.com/paperclipai/paperclip/pull/6071#issuecomment-4467322830)

> ## PR refresh verification (heartbeat)
> 
> I re-ran PR-readiness checks on top of `986df210a3cd3ad74e0e19fbbd066b1c1410ae8f`.
> 
> Validation:
> - `git diff --name-only public-gh/master...HEAD` -> no
>   - `.github/workflows/pr.yml`
>   - `ui/package.json`
>   - `pnpm-lock.yaml`
> - `pnpm -r typecheck`
> - `pnpm test:run -- --mode general`
> - `pnpm test:run -- --mode serialized --shard-index 0 --shard-count 1`
> - `pnpm build`
> 
> `pnpm test:run` (both modes) completed with passing suites and no assertion failures. Logs contain expected environment/tooling warnings/skips (e.g., macOS SSH fixture skips, connection cleanup/error logging) that are known in this suite.
> 
> No `.github/workflows/pr.yml`, `ui/package.json`, or `pnpm-lock.yaml` file changes remain in PR diff.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
