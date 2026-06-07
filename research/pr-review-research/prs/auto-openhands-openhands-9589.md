# OpenHands/OpenHands #9589 — [Refactor]: Add LLMRegistry for llm services

**[View PR on GitHub](https://github.com/OpenHands/OpenHands/pull/9589)**

| | |
|---|---|
| **Author** | @malhotra5 |
| **Status** | ✅ merged |
| **Opened** | 2025-07-07 |
| **Repo importance** | ★75,896 · 9,635 forks · score 119,434 |
| **Diff** | +2385 / −826 across 84 files |
| **Engagement** | 18 conversation · 111 inline review comments |

## Top review comments (ranked by reactions)

### @malhotra5 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9589#issuecomment-3193051949)

> I will be looking to merge this over this weekend!

### @malhotra5 — 1 reactions  
`👍 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9589#issuecomment-3064115545)

> Spend tracking is working as expected for conversation started with GUI!
> 
> I have the following left to do
> 
> - Refactor resolver, headless, CLI, etc to use LLMRegistry
> - Ensure docker nested conversation uses LLMRegistry + can handle extraneous llm requests as well
> - Write comprehensive unit tests

### @malhotra5 — 1 reactions  
`👍 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9589#issuecomment-3181977688)

> Thanks a bunch for the reviews! Mahmoud has made a release but things are looking somewhat unstable in prod, so I suspect we will be making many patch releases
> 
> I will do a QA soon, but still hold off merging until things are stable again (unless this is super urgent for model routing)

### @xingyaoww — 1 reactions  
`👍 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9589#issuecomment-3193815289)

> @enyst maybe we can ask an agent check to see if it can help rohit resolve the merge conflict in this PR by sending another PR that merge into centralized-metrics?

### @enyst — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9589#issuecomment-3193844406)

> OpenHands-GPT-5 — quick context on the large diff and how to review:
> 
> - The 400+ files / ~8k lines come from origin/main since this branch diverged (e.g., test reorg, doc/assets updates); these are mostly moves/renames, not manual edits here.
> - Manual conflict resolution by us only touched:
>   - openhands/controller/state/state_tracker.py
>   - openhands/server/session/session.py
>   - openhands/storage/locations.py
>   - tests/unit/controller/test_agent_controller.py
>   - tests/unit/controller/test_agent_delegation.py
>   - tests/unit/server/session/test_agent_session.py
> - Key updates: adopt ConversationStats + LLMRegistry (budget sync via combined metrics), Session now uses LLMRegistry + ExperimentManagerImpl, and get_experiment_config_filename restored for existing callers.
> - Review tip: in Files changed, filter to openhands/controller|server|storage and the 3 test files above; enable “Hide whitespace changes”.
> - Status: linters/format/mypy pass locally after fixes. Helper PR into this branch: #10430. If preferred, I can push the merge commit directly here and close #10430.

### @enyst — 1 reactions  
`👀 1`  ·  [link](https://github.com/OpenHands/OpenHands/pull/9589#issuecomment-3193947978)

> @openhands This PR has merge conflicts with main branch.
> 
> There are two kinds: most tests are in a category where the conflicts are not about semantics, but a very recent commit has moved test files. Find the commit and understand how to fix most test files.
> 
> Fix merge conflicts on a separate branch built from this, and make a PR to this PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
