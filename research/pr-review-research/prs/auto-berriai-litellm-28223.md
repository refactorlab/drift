# BerriAI/litellm #28223 — CI: copy of #25177 (OCI GenAI: embeddings, streaming/reasoning fixes, model catalog)

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/28223)**

| | |
|---|---|
| **Author** | @mateo-berri |
| **Status** | ✅ merged |
| **Opened** | 2026-05-19 |
| **Repo importance** | ★49,453 · 8,643 forks · score 89,007 |
| **Diff** | +7013 / −1661 across 28 files |
| **Engagement** | 71 conversation · 137 inline review comments |

## Top review comments (ranked by reactions)

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/BerriAI/litellm/pull/28223#issuecomment-4485033352)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/BerriAI/litellm?pullRequest=28223) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you all sign our [Contributor License Agreement](https://cla-assistant.io/BerriAI/litellm?pullRequest=28223) before we can accept your contribution.<br/>**2** out of **4** committers have signed the CLA.<br/><br/>:white_check_mark: fede-kamel<br/>:white_check_mark: mateo-berri<br/>:x: cursoragent<br/>:x: claude<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/BerriAI/litellm?pullRequest=28223) it.</sub>

### @mateo-berri — 0 reactions  
`—`  ·  [link](https://github.com/BerriAI/litellm/pull/28223#issuecomment-4505718979)

> Both concerns in this summary are addressed on HEAD (`f5993d9`); the summary just hasn't been re-run since the relevant commits landed:
> 
> **Concern 1 — `_model_uses_max_completion_tokens` hardcodes `openai.gpt-5*`**
> 
> Fixed in `1a9e036` (refined further in subsequent commits). The function in `litellm/llms/oci/chat/transformation.py` is now catalog-driven:
> 
> ```python
> def _model_uses_max_completion_tokens(model: str) -> bool:
>     if not model:
>         return False
>     name = model[4:] if model.lower().startswith("oci/") else model
>     return supports_reasoning(model=name, custom_llm_provider="oci")
> ```
> 
> The `"openai.gpt-5"` prefix and the dead `or name == "openai.gpt-5"` branch are gone — selection now reads `supports_reasoning` (i.e. the `supports_reasoning: true` flag in `model_prices_and_context_window.json`), so any new OCI model family that opts into reasoning automatically routes to `maxCompletionTokens` without a code change. The corresponding line-level threads `3264166929`, `3264164029`, `3264167145` are all resolved.
> 
> **Concern 2 — four `ServiceUnavailableError` messages contain proxy-specific language**
> 
> Fixed in the same series of commits. All four callsites in `litellm/router.py` (lines 10767, 11031, 11205, 11362) now raise the SDK-neutral message:
> 
> ```python
> raise litellm.ServiceUnavailableError(
>     message=f"Model '{model}' is currently paused and cannot accept requests.",
>     model=model,
>     llm_provider="",
> )
> ```
> 
> `"Contact your proxy admin to unblock it."` no longer appears anywhere in `router.py`. The line-level threads `3264167026` and `3264163923` are re … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
