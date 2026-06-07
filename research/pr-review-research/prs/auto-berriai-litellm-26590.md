# BerriAI/litellm #26590 — [Feat] Add tool calling support for gemini and vertex ai live api

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/26590)**

| | |
|---|---|
| **Author** | @Sameerlite |
| **Status** | ✅ merged |
| **Opened** | 2026-04-27 |
| **Repo importance** | ★49,453 · 8,643 forks · score 89,007 |
| **Diff** | +3220 / −130 across 11 files |
| **Engagement** | 83 conversation · 136 inline review comments |

## Top review comments (ranked by reactions)

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26590#issuecomment-4522796319)

> @greptileai please re-review — the non-deferred session.update tool drop concern has been addressed in commit ba75de7848 (subsequent updates are now merged with the original setup).

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26590#issuecomment-4522913007)

> @greptileai please re-review HEAD (`b60cc950f3`). The summary still references the removed `if self.session_configuration_request is not None: return` guard in `_cache_session_configuration_request` — that guard was deleted in 615a7da9ba (current lines 288-302), so each follow-up merged setup now overwrites the cache and subsequent `session.update` merges run against the latest sent setup, not the original.

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26590#issuecomment-4522925373)

> @greptileai please re-review HEAD (`c59260fc70`). Addressed the remaining concern: `_handle_function_call_output` now uses `.get()` instead of `.pop()` on `_tool_call_id_to_name`, so retried `function_call_output` items still produce a Gemini `toolResponse` with the required `name`.

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26590#issuecomment-4522941896)

> @greptileai please re-review HEAD (`0780e5f69f`). Addressed comment 3291372227 — the empty-`toolCall` path now returns a normal empty result instead of falling through to the `Unknown message type` guard, so the WebSocket no longer dies on a benign Gemini no-op.
> 
> Note: the previous summary said the tool-call `response.created` preamble omits `modalities` — `modalities`, `temperature`, and `max_output_tokens` are all present on the `response` object since b60cc950f3 (file `litellm/llms/gemini/realtime/transformation.py`, around line 1291).

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26590#issuecomment-4523011551)

> @greptileai please re-review HEAD (`459c1973b4`). Addressed both new concerns from the previous summary:
> 
> 1. The follow-up setup merge now deep-merges `realtimeInputConfig.automaticActivityDetection` so a partial guardrail update no longer drops `silenceDurationMs`/`prefixPaddingMs` from the original setup.
> 2. The summary noted Gemini deferred-mode omitting an 800 ms silence-duration default that the non-deferred path always set — but the non-deferred Gemini path (`session_configuration_request`) does not set `silenceDurationMs` either (Gemini follows the live API server VAD default). Only Vertex AI sets 800 ms, in both deferred (`_build_vertex_ai_setup_config`) and non-deferred (`session_configuration_request`) paths, so no inconsistency to fix there.

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26590#issuecomment-4523035776)

> @greptileai please re-review HEAD (`20764dd342`).
> 
> Addresses the two minor concerns from the previous summary:
> 
> 1. Synthetic `session.created` is now run through `RealTimeStreaming.store_message` before being sent to the client so the deferred-setup event lands in the session log alongside provider-driven events.
> 2. The follow-up setup merge now deep-merges `realtimeInputConfig.automaticActivityDetection` so a partial VAD update preserves `silenceDurationMs`/`prefixPaddingMs` from the original setup.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
