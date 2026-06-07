# pewdiepie-archdaemon/odysseus #1211 — chore: add PR template, issue templates

**[View PR on GitHub](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211)**

| | |
|---|---|
| **Author** | @PovilasKirna |
| **Status** | ✅ merged |
| **Opened** | 2026-06-02 |
| **Repo importance** | ★54,860 · 6,488 forks · score 85,809 |
| **Diff** | +244 / −0 across 4 files |
| **Engagement** | 32 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @pewdiepie-archdaemon — 2 reactions  
`😕 2`  ·  [link](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211#issuecomment-4604884466)

> The template content looks useful and the issue-template YAML parses locally (`bug_report.yml`, `feature_request.yml`, `config.yml`). This is exactly the kind of low-risk repo-management change that should help triage.
> 
> One final refresh needed before merge: the direct two-dot diff still includes already-merged files from recent PRs (`mcp_servers/rag_server.py`, `odysseus-ui.service`, `static/js/markdown.js`, `tests/test_markdown_rendering_js.py`). Please rebase/merge latest `main` so the PR contains only:
> 
> ```text
> .github/ISSUE_TEMPLATE/bug_report.yml
> .github/ISSUE_TEMPLATE/config.yml
> .github/ISSUE_TEMPLATE/feature_request.yml
> .github/pull_request_template.md
> ```
> 
> After that this should be straightforward to merge.

### @pewdiepie-archdaemon — 1 reactions  
`👍 1`  ·  [link](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211#issuecomment-4603610756)

> I would not merge this as-is.
> 
> The issue/PR templates are useful directionally, but the workflow policy is too aggressive for the current repo state:
> 
> - Auto-closing every issue and PR from accounts younger than 7 days will reject legitimate first-time contributors during the exact surge where many useful fixes are coming from new accounts.
> - `pull_request_target` with write permissions should be used very conservatively. This workflow does not checkout code, which avoids the worst case, but it still gives an automation path the ability to close PRs/comments on untrusted contributions. I would keep templates first and add automation later after the policy is agreed.
> - The PR template says PRs must target `dev`, but the repo is currently using `main` for active review/merges. That would confuse contributors unless a dev branch policy is actually adopted first.
> - “No `any` in TypeScript” / `pnpm run generate:api` / ADR/CONTEXT requirements do not match the current codebase consistently yet. Good future standards, but too much to enforce in a template before the project structure/tooling is accepted.
> - Disabling blank issues entirely may be okay, but I would start with templates + contact links, not a bot that closes submissions.
> 
> Suggested safer split:
> 
> 1. PR template only, adjusted to current `main` workflow and current stack.
> 2. Issue templates/config only.
> 3. Separate triage workflow proposal after maintainers agree on account-age/body policies, probably warning/labeling first instead of closing.

### @PovilasKirna — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211#issuecomment-4603815325)

> > Not sure if you're open to comments or suggestions (sorry if I'm overstepping), but would you be open to bringing in some changes from my PR—particularly the workflow updates?
> 
> of course please share and I will update I want this all to be best for everyone, it's a bit difficult with sparse communication from the overlords though i think this daemon has taken a liking at me

### @glenn2223 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211#issuecomment-4603984673)

> > triage has been pushed to later when mods will decide all the rules
> 
> Thanks for the note. If you (or the overlords) can keep them in mind, that'd be mighty kind.
> 
> Thanks again for reviewing my alt PR and being all nice 🥰

### @jhs88 — 1 reactions  
`😄 1`  ·  [link](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211#issuecomment-4604239733)

> U really need to set up gitflow this is ridiculous lol

### @pewdiepie-archdaemon — 1 reactions  
`👍 1`  ·  [link](https://github.com/pewdiepie-archdaemon/odysseus/pull/1211#issuecomment-4604301059)

> This is still the right kind of change for reducing tracker noise: templates/config only, no workflows or automation. I cannot merge the current branch because it is very stale against current `main`: `git diff --name-only origin/main..HEAD` includes a large set of already-merged runtime/test files in addition to the four `.github` template files.
> 
> Please rebase/refresh onto latest `main` so the two-dot diff contains only:
> 
> ```
> .github/ISSUE_TEMPLATE/bug_report.yml
> .github/ISSUE_TEMPLATE/config.yml
> .github/ISSUE_TEMPLATE/feature_request.yml
> .github/pull_request_template.md
> ```
> 
> After that, this should be a straightforward templates-only review.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
