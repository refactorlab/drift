# BerriAI/litellm #26569 — Litellm oss staging 04 21 2026 2

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/26569)**

| | |
|---|---|
| **Author** | @Sameerlite |
| **Status** | ✅ merged |
| **Opened** | 2026-04-27 |
| **Repo importance** | ★49,453 · 8,643 forks · score 89,007 |
| **Diff** | +5822 / −237 across 60 files |
| **Engagement** | 82 conversation · 103 inline review comments |

## Top review comments (ranked by reactions)

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26569#issuecomment-4501904073)

> @greptileai please re-review — `_async_refresh_locks` is now explicitly pruned by `_maybe_prune_async_refresh_lock` (called from the `finally:` block of `get_access_token_async`), and `_background_refresh_tasks` is pruned via an identity-checked done_callback in `_schedule_background_refresh`. Both dict-growth concerns should be resolved as of commit `bf23dc5`.

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26569#issuecomment-4501966358)

> @greptileai please re-review — `_async_refresh_locks` is now explicitly pruned by `_maybe_prune_async_refresh_lock` (commit bf23dc5, called from the `finally:` block of `get_access_token_async`), and the silent OCR `0.0` path now logs a `verbose_logger.warning` before returning (commit f6b2860). Both items flagged in the previous summary should be resolved.

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26569#issuecomment-4502092484)

> @greptileai please re-review — commit 6e5319a addresses the two findings from the previous summary:
> - vertex_llm_base.py: blocking refresh now drains any in-flight `_background_refresh_tasks` entry via `_await_in_flight_background_refresh` before calling `refresh_auth`, eliminating the narrow window where google-auth `Credentials.refresh()` could be invoked concurrently.
> - router.py: when alias registration preserves the shared backend `mode` instead of the deployment-specified one, a `verbose_router_logger.warning` is now emitted so the override is visible to operators.

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26569#issuecomment-4502623560)

> @greptileai re-review on the two remaining items in the 5/5 summary (`litellm/llms/fireworks_ai/chat/transformation.py` — cache invalidation edge case; `litellm/llms/xai/chat/transformation.py` — streaming normalization applied to every chunk). Both are explicitly labeled "speculative" in the summary itself, and on inspection neither has a fix that is net-positive:
> 
> **Fireworks `_get_fireworks_index` cache (`(id(model_cost), len(model_cost))` signature).** The cache is invalidated whenever `litellm.model_cost` is replaced (id changes) or whenever an entry is added or removed (len changes). The flagged edge case is in-place mutation of an *existing* `fireworks_ai/...` entry's dict — e.g. someone reaches into `litellm.model_cost['fireworks_ai/...']` and sets `supports_reasoning = True` without going through `register_model`. The only ways to detect this are (a) drop the cache and re-scan tens of thousands of `model_cost` entries on every `get_provider_info` call (the whole reason the index exists is to avoid that scan), or (b) compute a content hash of every cached entry on every call (strictly more expensive than no cache). The current heuristic catches every supported mutation path (`register_model`, full reload, dict replacement) and the in-place-mutate path is not exercised anywhere in the tree. Fixing this is neutral-or-worse.
> 
> **xAI `_normalize_openai_compatible_usage_totals` in `XAIChatCompletionStreamingHandler.chunk_parser`.** The helper only ever *raises* `total_tokens` to satisfy `total >= prompt + completion`; it never lowers it and never touches a chunk that does … *[truncated]*

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26569#issuecomment-4504000826)

> @greptileai re-review on the remaining 5/5 summary item:
> 
> > litellm/proxy/ocr_endpoints/endpoints.py — hardcoded `reducto://` check should migrate to a provider-agnostic hook over time
> 
> Marking this wontfix for now — implementing the fix today is neutral-or-worse, and the summary itself frames it as "over time" tech debt rather than a defect:
> 
> - **Reducto is currently the only OCR provider in the tree with a provider-native file-ID scheme.** `litellm/llms/mistral/ocr/`, `litellm/llms/azure_ai/ocr/`, and `litellm/llms/vertex_ai/ocr/` do not expose `<scheme>://` IDs that survive across requests; only `litellm/llms/reducto/common.py` defines `REDUCTO_ID_PREFIX = "reducto://"`. A registration/discovery hook for a one-element set is the textbook definition of premature abstraction.
> - **The current check is 8 lines with an explicit security comment** (`litellm/proxy/ocr_endpoints/endpoints.py:181-197`) and lives next to the analogous `document.type == "file"` reject. Both are concrete, locally-readable security guards. Replacing them with a provider-agnostic hook adds: per-provider prefix registration, a registry/lookup at request-validation time, more tests, and an extra layer of indirection between the security check and the JSON shape it guards — strictly more complexity for the same behavior.
> - **Removing or moving the check is not on the table** — the per-call upload security property the check enforces is provider-specific (Reducto issues `reducto://` IDs that are not scoped to the LiteLLM key, and replaying another tenant's ID would use the proxy's shared provider credenti … *[truncated]*

### @mateo-berri — 1 reactions  
`👍 1`  ·  [link](https://github.com/BerriAI/litellm/pull/26569#issuecomment-4504120946)

> @greptileai re-review on the two remaining 5/5 summary items:
> 
> > The observations flagged are minor observability/maintainability nits that do not affect correctness or safety.
> > litellm/integrations/rubrik.py (empty-choices fail-open semantics) and litellm/router.py (silent mode preservation when deployment omits mode).
> 
> Marking both wontfix — the summary itself frames them as "nits that do not affect correctness or safety", and on inspection neither has a fix that is net-positive.
> 
> **1. `litellm/integrations/rubrik.py` — empty-choices fail-open semantics.** `apply_guardrail` is declared fail-open on its docstring (`"Validate tool calls against the blocking service (fail-open)."`, `litellm/integrations/rubrik.py:181`). The empty-choices path in `_extract_blocked_tools` raises `"Tool blocking service returned empty response"` (line 557), which bubbles up to the `except Exception` arm in `apply_guardrail` (lines 195–201) — that arm logs the error with `verbose_logger.error(..., exc_info=True)` and returns `inputs` unchanged. So the empty-choices outcome is (a) logged with a stack trace at `error` level (not silent), and (b) consistent with the documented fail-open contract for the whole guardrail. The only alternative — fail-closed when the blocking service returns a malformed/empty body — would make every transient blocking-service hiccup translate into a hard block on legitimate user tool calls through the gateway, which is strictly worse for availability than the current behavior. The current shape is the documented intent.
> 
> **2. `litellm/router.py` — silent mode preserva … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
