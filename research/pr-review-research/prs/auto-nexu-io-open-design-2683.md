# nexu-io/open-design #2683 — ci: gate fork PR workflow auto-approval

**[View PR on GitHub](https://github.com/nexu-io/open-design/pull/2683)**

| | |
|---|---|
| **Author** | @mrcfps |
| **Status** | ✅ merged |
| **Opened** | 2026-05-22 |
| **Repo importance** | ★59,370 · 6,689 forks · score 91,125 |
| **Diff** | +1236 / −150 across 7 files |
| **Engagement** | 36 conversation · 74 inline review comments |

## Top review comments (ranked by reactions)

### @mrcfps — 1 reactions  
`👀 1`  ·  [link](https://github.com/nexu-io/open-design/pull/2683#issuecomment-4518017307)

> **Looper fixer round complete** — d8d6266
> 
> - ✅ Review comment on `scripts/approve-fork-pr-workflows.test.ts:1` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287804227)
>   - Updated the root guard script in package.json so pnpm guard now runs both scripts/style-policy.test.ts and scripts/approve-fork-pr-workflows.test.ts, putting the new fork-approval regression suite under the enforced repo check.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/2683#issuecomment-4516927257)

> **Looper fixer round complete** — 7340761
> 
> - ✅ Review comment on `scripts/approve-fork-pr-workflows.ts:238` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3286892595)
>   - I updated scripts/approve-fork-pr-workflows.ts to normalize GitHub workflow run paths by stripping any  suffix before checking the allowlist, so eligible fork PR runs are no longer filtered out.
> - • Review comment on `scripts/approve-fork-pr-workflows.ts:238` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3286962428)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/2683#issuecomment-4517013161)

> **Looper fixer round complete** — 7e25a5f
> 
> - ✅ Review comment on `scripts/approve-fork-pr-workflows.ts` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3286962428)
>   - Updated scripts/approve-fork-pr-workflows.ts to match approval-gated runs on conclusion === "action_required" without relying on pull_requests, and added scripts/approve-fork-pr-workflows.test.ts with a captured empty-pull_requests regression fixture.
> - • Review comment on `scripts/approve-fork-pr-workflows.ts` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287004033)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/2683#issuecomment-4517104191)

> **Looper fixer round complete** — 7a1e88f
> 
> - ✅ Review comment on `scripts/approve-fork-pr-workflows.ts` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287069349)
>   - I updated scripts/approve-fork-pr-workflows.ts so the denylist regex also matches tool config filenames like vite.config.ts, vitest.config.ts, and playwright.config.ts, and added a regression test in scripts/approve-fork-pr-workflows.test.ts.
> - • Review comment on `scripts/approve-fork-pr-workflows.ts:247` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287089608)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/2683#issuecomment-4517138487)

> **Looper fixer round complete** — 077e178
> 
> - ✅ Review comment on `scripts/approve-fork-pr-workflows.ts` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287089608)
>   - I added a short bounded poll loop before concluding there are no action_required runs in scripts/approve-fork-pr-workflows.ts, and added regression coverage for both the retry-success and retry-exhausted cases in scripts/approve-fork-pr-workflows.test.ts.
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>

### @mrcfps — 0 reactions  
`—`  ·  [link](https://github.com/nexu-io/open-design/pull/2683#issuecomment-4517242258)

> **Looper fixer round complete** — a618bcb
> 
> - ✅ Review comment on `scripts/approve-fork-pr-workflows.ts:135` (@chatgpt-codex-connector) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287156318)
>   - Updated scripts/approve-fork-pr-workflows.ts to require each approvable run to map back to the target PR, failing closed when the head SHA is associated with multiple open PRs, and added regression tests in scripts/approve-fork-pr-workflows.test.ts for ambiguous shared-head cases.
> - • Review comment on `scripts/approve-fork-pr-workflows.ts:135` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287172463)
>   - Agent did not provide a decision for this thread
> - • Review comment on `scripts/approve-fork-pr-workflows.ts:181` (@nettee) — [thread](https://github.com/nexu-io/open-design/pull/2683#discussion_r3287172473)
>   - Agent did not provide a decision for this thread
> 
> <sub>🔁 Powered by <a href="https://github.com/nexu-io/looper">Looper</a> · runner=fixer · agent=opencode · An autonomous AI dev team for your GitHub repos.</sub>


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
