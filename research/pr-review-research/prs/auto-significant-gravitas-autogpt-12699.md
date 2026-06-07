# Significant-Gravitas/AutoGPT #12699 — feat(builder): AI chat panel for the flow builder

**[View PR on GitHub](https://github.com/Significant-Gravitas/AutoGPT/pull/12699)**

| | |
|---|---|
| **Author** | @majdyz |
| **Status** | ✅ merged |
| **Opened** | 2026-04-07 |
| **Repo importance** | ★184,771 · 46,188 forks · score 374,523 |
| **Diff** | +3612 / −3590 across 51 files |
| **Engagement** | 77 conversation · 1349 inline review comments |

## Top review comments (ranked by reactions)

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12699#issuecomment-4200833754)

> ## 🧪 E2E Test Report
> # E2E Test Report: PR #12699 — feat(frontend/builder): add builder chat panel
> Date: 2026-04-07
> Branch: feat/builder-chat-panel
> Commits tested: 77f41d0cc6 (latest)
> 
> ## Environment
> - Docker services: all running (rest_server, copilot_executor, executor, frontend, websocket_server, etc.)
> - Auth: Claude Code OAuth subscription mode (CHAT_USE_CLAUDE_CODE_SUBSCRIPTION=true)
> - Test user: test@test.com
> 
> ## Test Results
> 
> ### S1: Panel toggle
> **Steps:**
> 1. Navigate to /build
> 2. Click "Chat with builder" button (bottom-right)
> 3. Verify panel opens with "Chat with Builder" header
> 4. Click close button (X)
> 5. Verify panel hidden, toggle button still visible
> 
> **Expected:** Panel opens and closes correctly
> **Actual:** Panel toggle works perfectly. "Chat with Builder" header visible when open. Toggle button visible when closed.
> **Result:** ✅ PASS
> **Screenshots:** 02-builder-page.png, 03-panel-opened.png, 10-panel-closed.png
> 
> ---
> 
> ### S2: Session creation
> **Steps:**
> 1. Open the chat panel for the first time
> 2. Observe "Setting up chat session..." spinner
> 
> **Expected:** Session creation indicator shown briefly, then input available
> **Actual:** Session created successfully. API confirmed `/api/chat/sessions` returns 200.
> **Result:** ✅ PASS
> **Screenshots:** 04-after-session-created.png
> 
> ---
> 
> ### S3: Initial graph summary message
> **Steps:**
> 1. Open builder with existing graph (Calculator Orchestrator - 4 nodes, 5 connections)
> 2. Open chat panel
> 3. Verify initial message contains graph summary
> 
> **Expected:** Initial message includes node names, descriptions, and connections … *[truncated]*

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12699#issuecomment-4201725484)

> ## 🧪 E2E Test Report — Builder Chat Panel (PR #12699)
> 
> **Branch:** `feat/builder-chat-panel`
> **Date:** 2026-04-08
> 
> ### Results: 7/7 PASS ✅
> 
> | Scenario | Result |
> |----------|--------|
> | Chat panel opens on click | ✅ PASS |
> | Session creation and seed message sent | ✅ PASS |
> | AI response visible (auto-scroll fix) | ✅ PASS |
> | AI outputs correct `{"action":...}` JSON format | ✅ PASS |
> | "AI applied these changes" panel appears | ✅ PASS |
> | Canvas auto-refreshes after AI edits graph | ✅ PASS |
> | Panel stays open during multi-turn conversation | ✅ PASS |
> 
> ### Fixes verified in this test session
> 
> Three issues were found and fixed during testing:
> 
> 1. **`ffa955044d`** — Strengthened seed message JSON format instruction so AI reliably outputs `{"action": "update_node_input",...}` format (was outputting non-standard keys like `"block"`, `"change"`)
> 2. **`109f28d9d1`** — Auto-scroll to bottom when AI responds. The seed message was long enough to push the AI reply below the visible fold of the 70vh panel
> 3. **`0999739d19`** — Canvas auto-refresh via `invalidateQueries` after AI edits graph server-side via `edit_agent`
> 
> ### Key observations
> 
> - AI correctly parsed the graph context (4 nodes, 5 connections) from the seed message
> - When asked to update `OrchestratorBlock.system_prompt`, AI output exactly: `{"action": "update_node_input", "node_id": "2ba71bf5-...", "key": "system_prompt", "value": "..."}`
> - "AI applied these changes" section appears after AI responds with graph actions
> - Backend logs confirm graph re-fetch (via `invalidateQueries`) fires on `streaming→ready` status trans … *[truncated]*

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12699#issuecomment-4203641582)

> Hey @ntindle, commit `8f855e5` (Apr 7 19:47) addressed your feedback — all review threads are now resolved. Could you take another look when you get a chance? Thanks!

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12699#issuecomment-4204630765)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/Significant-Gravitas/AutoGPT?pullRequest=12699) <br/>All committers have signed the CLA.

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12699#issuecomment-4206990525)

> ## 🧪 E2E Test Report
> 
> **Result: ✅ ALL HEADLINE SCENARIOS PASS**
> 
> > Note: Feature flag enabled locally (`NEXT_PUBLIC_FORCE_FLAG_BUILDER_CHAT_PANEL`) for testing. Copilot session creation shows "Setting up..." as the local copilot_executor requires Claude CLI — this is expected in local dev, not a PR bug.
> 
> # E2E Test Report: PR #12699 — feat(frontend/builder): add builder chat panel for interactive agent editing
> Date: 2026-04-08
> Branch: feat/builder-chat-panel
> Worktree: /Users/majdyz/Code/AutoGPT2
> 
> ## Environment
> - Feature flag: `NEXT_PUBLIC_FORCE_FLAG_BUILDER_CHAT_PANEL=true` (default changed to `true` in `use-get-flag.ts`, LD disabled)
> - Auth: Local Supabase (token injected via localStorage)
> - Copilot: Not connected (requires Claude CLI in copilot_executor — expected in local dev)
> - Unit tests: 60/60 files passed (1025 tests)
> 
> ## Test Results
> 
> ### Scenario 1: Panel toggle — Chat panel opens via toggle button
> **Steps:** Click chat button (bottom-right circular button)
> **Expected:** Panel slides open with "Chat with Builder" header
> **Actual:** Panel opens with "Chat with Builder" header and X close button ✓
> **Result:** **PASS**
> **Screenshot:** 15-panel-opening.png
> 
> ### Scenario 2: Seed message hidden
> **Steps:** Open panel, inspect messages list
> **Expected:** System seed message (graph summary) NOT visible to user
> **Actual:** `seedVisible: false`, messageCount=2 but no seed text in UI ✓
> **Result:** **PASS**
> 
> ### Scenario 3: Manual confirmation (Apply/Reject buttons — NOT auto-apply)
> **Steps:** Code review + unit tests
> **Expected:** AI suggestions require user to click Apply p … *[truncated]*

### @majdyz — 0 reactions  
`—`  ·  [link](https://github.com/Significant-Gravitas/AutoGPT/pull/12699#issuecomment-4207287049)

> All 5 Should Fix items from the latest review have been addressed in commit 31a2371c26.
> 
> 1. **Dead code** — replaced dead else branch in handleApplyAction with TypeScript exhaustiveness check.
> 2. **Leaked seed message** — seedMessageId now matches by content prefix (SEED_PROMPT_PREFIX) not position.
> 3. **Action target validation** — key/handle guards against inputSchema/outputSchema already in place, confirmed correct.
> 4. **Hook test coverage** — added renderHook tests: session lifecycle (3 cases), handleApplyAction (9 cases), flowID reset (2 cases), empty input rejection.
> 5. **Async session ref guard** — root cause: setIsCreatingSession(true) re-triggered the effect cleanup (cancelled=true) before the promise resolved. Fixed with isCreatingSessionRef to gate re-entry without isCreatingSession in the dep array.
> 
> All 1031 tests passing, lint and types clean.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
