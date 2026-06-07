# vllm-project/vllm #12388 — [V1][Core] Support for Structured Outputs

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/12388)**

| | |
|---|---|
| **Author** | @aarnphm |
| **Status** | ✅ merged |
| **Opened** | 2025-01-24 |
| **Repo importance** | ★81,996 · 17,677 forks · score 157,703 |
| **Diff** | +1528 / −715 across 26 files |
| **Engagement** | 46 conversation · 262 inline review comments |

## Top review comments (ranked by reactions)

### @mmoskal — 5 reactions  
`👀 5`  ·  [link](https://github.com/vllm-project/vllm/pull/12388#issuecomment-2628455050)

> I love seeing structured decoding being intergrated deeply inside of vLLM!
> 
> I would love to see [llguidance](https://github.com/guidance-ai/llguidance) being supported though. Compared to XGrammar, it is [significantly faster](https://github.com/guidance-ai/jsonschemabench/tree/main/maskbench), has near-zero compilation time, and [has much broader](https://github.com/guidance-ai/llguidance/blob/main/docs/json_schema.md) JSON Schema support. We've been using it in production instances.
> 
> If needed I'm happy to add additional APIs to the Python bindings (server-side integrations so far have been native) or otherwise help.
> 
> ![timing diagram](https://github.com/user-attachments/assets/5aeade5e-4507-4232-9480-41e06c41edd5)

### @russellb — 4 reactions  
`👍 2 · ❤️ 2`  ·  [link](https://github.com/vllm-project/vllm/pull/12388#issuecomment-2695647432)

> @WoosukKwon just a quick update: I went through a bunch of your comments, but I'll need another day to finish.

### @russellb — 3 reactions  
`👍 3`  ·  [link](https://github.com/vllm-project/vllm/pull/12388#issuecomment-2688369888)

> @aarnphm proposed text for the PR description:
> 
> Updated PR title
> 
> [V1][Core] Structured Output support
> 
> Updated PR description
> 
> This PR introduces the first iteration of structured output support for the V1 engine.
> 
> While functional, it is not feature complete with the support in V0. We currently only support xgrammar as a backend. We do not have a fallback in place to outlines as we did in V0. Other backends will come in a follow-up.
> 
> While one of the goals in V1 is to minimize or eliminate conflicts between features, this does not yet work with speculative decoding. The features were developed in parallel and we haven’t had a chance to consider the interoperability challenges in depth. This will also be considered as possible follow-up work.
> 
> Some key points of the current design include:
> 
> * Compilation of the grammar for a structured output request is done asynchronously and will not block the scheduler or any other requests from getting scheduled in the meantime.
> * We keep a cache of compiled grammars for accelerating the case where the same grammar is used repeatedly.
> * Advancing the FSM and calculating the next logits bitmask is done in the scheduler and then broadcasted to the GPU workers with the rest of the inputs already being sent.
> * We arrange the bitmasks in a single tensor to be applied to the full batch of logits in a single operation.
> 
> There are several ideas on how this design might evolve. By using this as a functional starting point, we will be able to evaluate changes using benchmarks.

### @russellb — 2 reactions  
`👍 2`  ·  [link](https://github.com/vllm-project/vllm/pull/12388#issuecomment-2666096665)

> > Thanks for the progress! Please let me know when this PR is ready for review!
> 
> Will do. This PR should be marked as a draft, though I don't have permission to do that.

### @njhill — 2 reactions  
`👍 2`  ·  [link](https://github.com/vllm-project/vllm/pull/12388#issuecomment-2669764381)

> @andylolu2 we were just discussing this exact thing in the slack channel. But a decision was already made to take this approach for the first pass, we could perhaps reevaluate in the next iteration. I think part of the reason is due to the fact that the scheduling can depend on the result of the grammar processor including whether it's finished in time for the next step.

### @russellb — 2 reactions  
`👍 2`  ·  [link](https://github.com/vllm-project/vllm/pull/12388#issuecomment-2714193333)

> > This may caused error when use https://docs.vllm.ai/en/stable/features/tool_calling.html#named-function-calling . @aarnphm
> 
> There's a known issue with tool calling, but not caused by this PR. It should be resolved shortly


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
