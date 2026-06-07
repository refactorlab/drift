# OpenHands/OpenHands #9021 — Add Bitbucket microagent and backend implementation

**[View PR on GitHub](https://github.com/OpenHands/OpenHands/pull/9021)**

| | |
|---|---|
| **Author** | @neubig |
| **Status** | ✅ merged |
| **Opened** | 2025-06-09 |
| **Repo importance** | ★75,896 · 9,635 forks · score 119,434 |
| **Diff** | +2175 / −116 across 47 files |
| **Engagement** | 65 conversation · 104 inline review comments |

## Top review comments (ranked by reactions)

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9021#issuecomment-2957435172)

> @openhands:
> 
> 1. delete the interface and just keep the microagent
> 2. delete the "git" trigger, and only keep "bitbucket"

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9021#issuecomment-2968714129)

> @openhands check for all the places where "gitlab" is mentioned in the codebase. does this PR have parallels for bitbucket? If you're not sure of the bitbucket coding conventions etc, you can search the web for APIs and docs

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9021#issuecomment-2968824420)

> @openhands check all failing CI actions and find which workflows they correspond to. continue running those workflows locally until they all pass, then push back to github. when you fix formatting with pre-commit, ONLY fix files that were changed in this pr

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9021#issuecomment-2968902777)

> @openhands locally run the frontend unit testing workflow and fix any failing tests, then run pre-commit only on the files changed in this PR and fix them

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9021#issuecomment-2968968893)

> @openhands run py-unit-tests.yml step-by-step 100% faithfully. you must follow the steps there. if any tests fail, fix them and then re-run py-unit-tests.yml

### @neubig — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9021#issuecomment-2969002811)

> @openhands Use the ATLASSIAN_API_KEY secret to test the component functions introduced in this PR against this repo: https://bitbucket.org/all-hands-ai/test-repo/src


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
