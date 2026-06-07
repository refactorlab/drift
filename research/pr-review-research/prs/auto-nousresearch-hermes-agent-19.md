# NousResearch/hermes-agent #19 — Enhance async tool execution and error handling in Hermes agent for A…

**[View PR on GitHub](https://github.com/NousResearch/hermes-agent/pull/19)**

| | |
|---|---|
| **Author** | @teknium1 |
| **Status** | ✅ merged |
| **Opened** | 2026-02-08 |
| **Repo importance** | ★181,539 · 31,151 forks · score 311,143 |
| **Diff** | +540 / −64 across 9 files |
| **Engagement** | 133 conversation · 364 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @runlvl — 0 reactions  
`—`  ·  [link](https://github.com/NousResearch/hermes-agent/pull/19#issuecomment-4274578499)

> ## Code Review Summary
> 
> **Verdict: Reviewed 💬** (2 issues, 0 suggestions)
> 
> **PR:** #19 — Enhance async tool execution and error handling in Hermes agent for Atropos integration
> **Author:** @teknium1
> **Files changed:** 9 (+540 -64)
> 
> I reviewed the diff locally against `main` and ran the available terminal-backend test script on this checkout:
> 
> - `python3 -m py_compile environments/agent_loop.py environments/hermes_base_env.py environments/patches.py environments/tool_context.py model_tools.py tools/file_tools.py tools/terminal_tool.py` ✅
> - `pytest tests/test_modal_terminal.py -q` ✅ (`6 passed`, with `PytestReturnNotNoneWarning` warnings from the test file itself)
> 
> ### ⚠️ Warnings
> - **tools/file_tools.py:59** — `_get_file_ops()` now creates non-local environments without forwarding the backend-specific parameters that `terminal_tool()` passes (`task_id`, `ssh_config`, and container config). That means file tools no longer mirror terminal-tool backend semantics: SSH backends fail immediately because `_create_environment()` requires `ssh_host`/`ssh_user`, and docker/modal lose per-task identity/resource settings.
> - **environments/tool_context.py:123** — `terminal()` and `call_tool()` were updated to use the async-safe thread helper, but the common convenience wrappers (`read_file`, `write_file`, `search`) still dispatch directly via `handle_function_call(...)`. If verifier code uses those wrappers with modal/docker backends, it can still take the old non-async-safe path this PR is trying to eliminate.
> 
> ### ✅ Looks Good
> - The new `ToolError` tracking in `environments/agent_loop … *[truncated]*

### @runlvl — 0 reactions  
`—`  ·  [link](https://github.com/NousResearch/hermes-agent/pull/19#issuecomment-4274579183)

> ## Code Review Summary
> 
> **Verdict: Reviewed 💬** (1 issue, 1 suggestion)
> 
> **PR:** #19 — Enhance async tool execution and error handling in Hermes agent for Atropos integration
> **Author:** @teknium1
> **Files changed:** 9 (+540 -64)
> 
> _Post-merge note: this PR is already merged, so I left an informational review instead of a formal “request changes”. Pre-merge, I would have blocked on the item below._
> 
> ### 🔴 Critical
> - **tools/file_tools.py:64** — `file_tools._get_file_ops()` now creates environments for the configured backend, but it does not pass `ssh_config` into `_create_environment()`. Repro: with `TERMINAL_ENV=ssh`, `TERMINAL_SSH_HOST=example.com`, and `TERMINAL_SSH_USER=tester`, calling `_get_file_ops('review-ssh-repro')` raises `ValueError: SSH environment requires ssh_host and ssh_user to be configured`. This breaks file tools on SSH-backed tasks even when terminal config is valid.
> 
> ### 💡 Suggestions
> - Add a regression test that exercises file tools on at least one non-local backend path (SSH is the clearest one). The current test coverage did not catch the backend handoff regression above.
> 
> ### ✅ Looks Good
> - Moving environment creation out of the terminal lock is a sensible concurrency improvement for slow backends like Modal/Docker.
> - The added tool-error tracking in the agent loop should make Atropos failures much easier to debug.
> - `py_compile` passes for all touched Python files, so there are no obvious syntax regressions in the patch itself.
> 
> ---
> *Reviewed by Hermes Agent*

### @runlvl — 0 reactions  
`—`  ·  [link](https://github.com/NousResearch/hermes-agent/pull/19#issuecomment-4274580638)

> ## Code Review Summary
> 
> Reviewed after merge. I found 1 follow-up issue and 1 warning worth addressing.
> 
> ### Critical
> - **environments/hermes_base_env.py:374** — `train/tool_error_details` logs raw tool arguments into Weights & Biases. Those arguments can contain credentials, tokens, file paths, or command fragments from failing tool calls. This pushes potentially sensitive runtime data into external telemetry.
>   Suggestion: redact/summarize arguments before logging, or gate detailed error logging behind an explicit debug flag.
> 
> ### Warnings
> - **environments/tool_context.py:52-60** — `_run_tool_in_thread()` detects a running event loop, then immediately blocks that same async path with `future.result(timeout=300)` on a one-off `ThreadPoolExecutor`. In `compute_reward()` this can stall the event loop and reduce rollout concurrency instead of preserving async-safety.
>   Suggestion: make this path awaitable and use `await loop.run_in_executor(...)`, or use a shared executor from the async caller rather than blocking inside the helper.
> 
> ### Suggestions
> - **environments/agent_loop.py:302-305** — tool-error detection only records returned JSON errors when `exit_code` is present and negative. Tools that return `{\"error\": ...}` without `exit_code`, or with a non-negative exit code, will be missed in telemetry.
>   Suggestion: treat any non-empty `error` field as an error, then optionally attach `exit_code` as extra metadata.
> 
> ### Looks Good
> - Moving slow environment creation out of the global lock in `terminal_tool.py` and `file_tools.py` should reduce contention across parallel rol … *[truncated]*

### @runlvl — 0 reactions  
`—`  ·  [link](https://github.com/NousResearch/hermes-agent/pull/19#issuecomment-4274581425)

> ## Code Review Summary
> 
> **Verdict: Comment** (2 warnings, 1 suggestion)
> 
> Reviewed post-merge. I ran `python3 -m py_compile` on the touched modules and `python3 -m pytest tests/test_modal_terminal.py tests/test_web_tools.py -q` locally; both passed.
> 
> ### Warnings
> - `environments/agent_loop.py:304` — tool-error accounting only records JSON results when both `error` and a negative `exit_code` are present. Several tools return `{"error": ...}` without an `exit_code` (for example `write_file_tool` in this PR), so the new W&B metrics will under-report real failures.
> - `environments/tool_context.py:279` — `cleanup()` flips `HERMES_QUIET` in `os.environ`, which is process-global. With concurrent rollouts this can mute unrelated tasks while one rollout is cleaning up its browser session.
> 
> ### Suggestions
> - Add a focused regression test around error aggregation / async cleanup paths so the Atropos-specific behavior is covered without relying only on the existing modal/web smoke tests.
> 
> ### Looks Good
> - Moving environment creation out of `_env_lock` in `terminal_tool`/`file_tools` is the right direction for avoiding rollout-wide stalls.
> - The Atropos compatibility shim is well-scoped and the updated tool-path smoke tests still pass locally.

### @runlvl — 0 reactions  
`—`  ·  [link](https://github.com/NousResearch/hermes-agent/pull/19#issuecomment-4274582147)

> ## Code Review Summary
> 
> **Verdict: Reviewed 💬** (1 critical, 1 warning)
> 
> **PR:** #19 — Enhance async tool execution and error handling in Hermes agent for Atropos integration
> **Author:** @teknium1
> **Files changed:** 9 (+540 -64)
> 
> ### 🔴 Critical
> - **environments/hermes_base_env.py:374** — `wandb_log()` includes raw tool arguments in `train/tool_error_details`. Failed tool-call args can carry secrets, local paths, or shell fragments, so this can leak sensitive runtime data into external telemetry.
> 
> ### ⚠️ Warnings
> - **environments/tool_context.py:52-60** — `_run_tool_in_thread()` avoids nested event loops, but it blocks the active async path with `future.result(timeout=300)`. That reduces verifier concurrency and introduces an undocumented 300s ceiling for `ToolContext` tool calls.
> 
> ### ✅ Looks Good
> - `ToolError` tracking in `environments/agent_loop.py` is a real debugging improvement.
> - Creating terminal environments outside the global lock should reduce contention for slow backends.
> - The changed Python files compile cleanly, and `pytest tests/test_modal_terminal.py -q` passed on the reviewed checkout.
> 
> ---
> *Reviewed by Hermes Agent*

### @runlvl — 0 reactions  
`—`  ·  [link](https://github.com/NousResearch/hermes-agent/pull/19#issuecomment-4274583204)

> ## Code Review Summary
> 
> **Verdict: Changes Requested 🔴** (1 critical, 2 warnings)
> 
> **PR:** #19 — Enhance async tool execution and error handling in Hermes agent for Atropos integration
> **Author:** @teknium1
> **Files changed:** 9 (+540 -64)
> 
> Retrospective review on the merged PR.
> 
> ### 🔴 Critical
> - **tools/file_tools.py:54-64** — `_get_file_ops()` creates a new environment with `cwd = config["cwd"]` before `terminal_tool()` runs, but it does not apply the per-task local workdir isolation that `terminal_tool()` adds in `tools/terminal_tool.py:1334-1344`. If a rollout hits a file tool first, later terminal calls reuse that already-created environment and run in the shared base cwd instead of the task-specific scratch dir. I reproduced this locally: calling `_get_file_ops('abc12345')` first, then `terminal_tool('pwd', task_id='abc12345')`, returned `/home/runlvl` instead of the generated `hermes-abc12345-*` directory. Suggestion: move the local-task-workdir selection into a shared environment-creation helper used by both terminal and file tools.
> 
> ### ⚠️ Warnings
> - **environments/tool_context.py:160-162** — `ToolContext.search()` passes `{"query": query, ...}` into `handle_function_call("search", ...)`, but `model_tools.py:1585-1595` only reads `pattern`. That means verifier code calling `ctx.search("needle")` silently drops the actual search term and falls back to an empty pattern. Suggestion: pass `pattern=query` here.
> - **environments/tool_context.py:277-289** — cleanup now mutates the process-global `HERMES_QUIET` env var around `cleanup_browser()`. `tools/terminal_tool.py:1 … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
