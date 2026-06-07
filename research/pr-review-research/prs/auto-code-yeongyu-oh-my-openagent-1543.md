# code-yeongyu/oh-my-openagent #1543 — refactor: migrate delegate_task to task tool with metadata fixes

**[View PR on GitHub](https://github.com/code-yeongyu/oh-my-openagent/pull/1543)**

| | |
|---|---|
| **Author** | @code-yeongyu |
| **Status** | ✅ merged |
| **Opened** | 2026-02-06 |
| **Repo importance** | ★61,138 · 4,947 forks · score 85,924 |
| **Diff** | +1182 / −403 across 78 files |
| **Engagement** | 28 conversation · 84 inline review comments |

## Top review comments (ranked by reactions)

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1543#issuecomment-3858497031)

> @cubic-dev-ai please re-review — fixed duplicate task entries, resume→session_id, and background=true→run_in_background=true

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1543#issuecomment-3858789480)

> @cubic-dev-ai please re-review — fixed duplicate task entry in sisyphus-junior/gpt.ts and added ses_ prefix guard to call-omo-agent/tools.ts getMessageDir

### @code-yeongyu — 1 reactions  
`👀 1`  ·  [link](https://github.com/code-yeongyu/oh-my-openagent/pull/1543#issuecomment-3858869551)

> @cubic-dev-ai please re-review — removed model-related changes (model-requirements.ts, migration.ts, features.md model refs, AGENTS.md model refs, related tests/snapshots) that were accidentally mixed into this PR. This PR now ONLY contains delegate_task→task rename + metadata fixes. Also fixed: empty-task-response-detector case sensitivity, task-resume-info duplicate entry, session timeout consistency, sisyphus-prompt required args, sisyphus.ts stale delegate_task text.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
