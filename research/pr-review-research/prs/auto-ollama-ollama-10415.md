# ollama/ollama #10415 — tools: refactor tool call parsing and enable streaming

**[View PR on GitHub](https://github.com/ollama/ollama/pull/10415)**

| | |
|---|---|
| **Author** | @ParthSareen |
| **Status** | ✅ merged |
| **Opened** | 2025-04-25 |
| **Repo** | curated review-culture seed |
| **Diff** | +1868 / −340 across 27 files |
| **Engagement** | 28 conversation · 154 inline review comments |

## Top review comments (ranked by reactions)

### @gluonfield — 6 reactions  
`👍 3 · ❤️ 3`  ·  [link](https://github.com/ollama/ollama/pull/10415#issuecomment-2852007775)

> Really important work  @ParthSareen, tool calling with streaming makes Ollama much more powerful. I was surprised to find out it didn't exist yet. For now I will be running your fork

### @ParthSareen — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/ollama/ollama/pull/10415#issuecomment-2899534284)

> > @ParthSareen I Would like to second @gluonfield here, at least on the part that OpenAI Client API compatibility is one of the most important features of Ollama for me, will this also enjoy these changes?
> 
> Overall, it should be compatible! We stream out tool calls a bit differently than OpenAI but the compatibility layer should work. I'll do some sanity checking before rolling this out :) I'm not familiar with their Go SDK and that seems a bit out of scope to also have compatibility with at this time (but I'll give it a quick look regardless).

### @ParthSareen — 2 reactions  
`🚀 2`  ·  [link](https://github.com/ollama/ollama/pull/10415#issuecomment-2852340505)

> @gluonfield yeah that's expected atm - identified a couple issues with the qwen2.5 and qwen2.5 coder templates so those will be fixed once this rolls out 😄

### @anyon17 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/ollama/ollama/pull/10415#issuecomment-2877827124)

> @ParthSareen thanks for the clarification! Awesome work with this PR btw, using this in my project and works just the way I hoped, thanks 🙌

### @ParthSareen — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/ollama/ollama/pull/10415#issuecomment-2908136157)

> @benhaotang thanks for also digging in! My gut also was pointing to that so thanks for confirming.
> 
> It's for the case where a prefix has a `\n` in it e.g. `[TOOL_CALL] \n [` where the model might output a space instead of a `\n`. To mitigate that we replace the newlines. However I think I should be able to move this to just the prefix checking portion rather than globally in the parser. Thanks for the help 😄

### @InfiniteCoder01 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/ollama/ollama/pull/10415#issuecomment-2886909120)

> Seems to work nicely (tested https://github.com/ollama/ollama/commit/8ed95a4e960702fbcb0191a80f52b69ef4172f67)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
