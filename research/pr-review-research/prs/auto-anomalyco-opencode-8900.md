# anomalyco/opencode #8900 — feat(opencode): add copilot specific provider to properly handle copilot reasoning tokens

**[View PR on GitHub](https://github.com/anomalyco/opencode/pull/8900)**

| | |
|---|---|
| **Author** | @SteffenDE |
| **Status** | ✅ merged |
| **Opened** | 2026-01-16 |
| **Repo importance** | ★170,163 · 20,357 forks · score 256,590 |
| **Diff** | +2381 / −17 across 33 files |
| **Engagement** | 47 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @caozhiyuan — 2 reactions  
`👍 2`  ·  [link](https://github.com/anomalyco/opencode/pull/8900#issuecomment-3775651280)

> for claude model , should pass header  "openai-intent": "conversation-agent" and thinking_budget?: number in ChatCompletionsPayload . for gemini-3-flash , copilot only return thinking signature, not return thinking text.

### @SteffenDE — 1 reactions  
`👍 1`  ·  [link](https://github.com/anomalyco/opencode/pull/8900#issuecomment-3767597840)

> @aadishv the reasoning_opaque is part of the previous assistant messages, not the user message. So your check would need to be `args.messages.at(-2).reasoning_opaque`
> 
> <img width="787" height="297" alt="image" src="https://github.com/user-attachments/assets/f46b0022-eb96-4725-aba3-4387478bcb71" />

### @SteffenDE — 1 reactions  
`👍 1`  ·  [link](https://github.com/anomalyco/opencode/pull/8900#issuecomment-3791240042)

> @iamEvanYT you're right, I misremembered. This is handled by transform.ts now!
> 
> I added a single "thinking" variant for anthropic models (https://github.com/anomalyco/opencode/pull/8900/commits/36ecf33a5b2c1d6ceb9d179629fdd2cfd0e88d06) that configures a fixed thinking budget of 4000. This is consistent to what I'm seeing Copilot in VSCode do. If needed, this can be adjusted to different variants.
> 
> @caozhiyuan I'm aware of the models endpoint. It would be nice if OpenCode used that to fetch available copilot models, but I'm not sure how to best do that, since currently all model information comes from models.dev. Maybe something to revisit in the future.

### @SteffenDE — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/anomalyco/opencode/pull/8900#issuecomment-3791246393)

> Screenshot of Haiku with thinking tokens:
> 
> <img width="1009" height="589" alt="image" src="https://github.com/user-attachments/assets/531f0820-13ab-48a4-8952-6a2bc58a46db" />

### @caozhiyuan — 1 reactions  
`👍 1`  ·  [link](https://github.com/anomalyco/opencode/pull/8900#issuecomment-3830170593)

> seems need change  "Openai-Intent" to "conversation-agent" and  variants  logic change to  if (model.id.includes("claude")) {
>           return {
>             high: { thinking_budget: Math.min(15_999, Math.floor(model.limit.output / 2 - 1)) },
>             max: { thinking_budget: Math.min(31_999, model.limit.output - 1) },
>           }
>         } for claude model thinking, but only can thinking in first turn (chat comletion not support interleaved thinking).  @SteffenDE and The gemini flash 3 model missed the reasoning_opaque thinking signature processing.

### @Coruscant11 — 0 reactions  
`—`  ·  [link](https://github.com/anomalyco/opencode/pull/8900#issuecomment-3761497376)

> Hello, I can confirm the reasoning works with Gemini 2.5 Pro however it doesn't seem to be the case with GPT 5.2 Codex / GPT 5.2 and Opus 4.5


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
