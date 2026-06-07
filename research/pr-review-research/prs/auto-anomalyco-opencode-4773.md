# anomalyco/opencode #4773 — Added: Ability to hide subagents from primary agents system prompt.

**[View PR on GitHub](https://github.com/anomalyco/opencode/pull/4773)**

| | |
|---|---|
| **Author** | @Sewer56 |
| **Status** | ✅ merged |
| **Opened** | 2025-11-26 |
| **Repo importance** | ★170,163 · 20,357 forks · score 256,590 |
| **Diff** | +580 / −6 across 8 files |
| **Engagement** | 63 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @Sewer56 — 4 reactions  
`👍 4`  ·  [link](https://github.com/anomalyco/opencode/pull/4773#issuecomment-3678037913)

> Well, what else does it take to get this merged?
> 
> I've been very active as far as applying the feedback is concerned; including keeping this branch synced with `dev`; merging conflicts and even adapting changes to it, e.g. renaming `visible` -> `hidden`.
> 
> I'm not really sure what I can do here anymore. This is simply a feature I need to save tokens, and prevent the LLM calling agents I don't want called; that simple.

### @rekram1-node — 4 reactions  
`🚀 4`  ·  [link](https://github.com/anomalyco/opencode/pull/4773#issuecomment-3717239533)

> hey today is my first day back I said id merge it :)

### @malhashemi — 3 reactions  
`👍 3`  ·  [link](https://github.com/anomalyco/opencode/pull/4773#issuecomment-3634481063)

> > **Disclaimer:** I designed this proposal but used Claude Opus 4.5 to help format and present it clearly.
> 
> ---
> 
> @rekram1-node / @Sewer56 
> 
> After thinking through the UX, I'd like to propose an alternative design that separates the two distinct concerns here:
> 
> 1. **Human visibility**: whether a subagent appears in menus/autocomplete
> 2. **LLM invocation control**: which subagents a primary agent can spawn
> 
> These are independent problems and conflating them creates the semantic confusion discussed above.
> 
> ---
> 
> ## Proposed Design
> 
> ### 1. Human Visibility: `visible` property on subagents
> 
> Add a `visible` property (default `true`) that controls whether a subagent appears in the agent selection menu.
> 
> **JSON config:**
> ```json
> {
>   "$schema": "https://opencode.ai/config.json",
>   "agent": {
>     "orchestrator-coder": {
>       "description": "Internal coding subagent for orchestration loops",
>       "mode": "subagent",
>       "visible": false
>     },
>     "orchestrator-planner": {
>       "description": "Internal planning subagent",
>       "mode": "subagent",
>       "visible": false
>     },
>     "code-reviewer": {
>       "description": "Reviews code for best practices",
>       "mode": "subagent",
>       "visible": true
>     }
>   }
> }
> ```
> 
> **Markdown frontmatter:**
> ```yaml
> ---
> description: Internal coding subagent for orchestration loops
> mode: subagent
> visible: false
> ---
> 
> You are a coding subagent. Focus on implementation tasks assigned by the orchestrator.
> ```
> 
> **Rules:**
> - `visible: false` hides the subagent from the agent menu.
> - Does NOT apply to `mode: primary` or `mode: all` agents (these are alw … *[truncated]*

### @rekram1-node — 3 reactions  
`❤️ 1 · 🚀 2`  ·  [link](https://github.com/anomalyco/opencode/pull/4773#issuecomment-3709151168)

> this is high on my list, im just out of town for a wedding but ill try to get this in
> 
> Edit: just got back from wedding too late tho gotta sleep

### @malhashemi — 2 reactions  
`👍 2`  ·  [link](https://github.com/anomalyco/opencode/pull/4773#issuecomment-3591712932)

> I really hope this one gets merged, asked for this to be implemented a while back, thanks for making it happen

### @Sewer56 — 2 reactions  
`👍 2`  ·  [link](https://github.com/anomalyco/opencode/pull/4773#issuecomment-3609454739)

> My only question is if you're okay with the semantic inconsistency here.
> 
> Technically the permissions field controls (or should control) what an LLM is allowed to invoke.
> 
> But in this case, we wouldn't be doing that, the LLM is given free range to call any subagent as it wishes.
> 
> When you do an @ call, you ask the LLM to invoke on your behalf, but the LLM is really the one doing the invoking. In that vein, it could re-invoke whenever it wants, or even start guessing names of 'hidden' subagents if they are predictable.
> 
> Sure you could do a 'hack', see if the previous user message mentioned a specific subagent and disallow if that was not the case, but even that has some caveats. For instance, the LLM is given free reign to call it 0-* times. Should we only give it one call? Should we give it multiple? There is ambiguity.
> 
> -------
> 
> In any case.
> 
> For me, part of the desired functionality is also to hide it from the humans too. I have subagents that are meant to be purely used by LLMs as part of orchestrator loops.
> 
> These subagents aren't used anywhere else but in these orchestrators, and I got multiple variants that use different models for speed/cost tradeoff. Without hiding I would have something like:
> 
> ```
> orchestrator-coder
> orchestrator-coder-high
> orchestrator-quality-gate-gpt5
> orchestrator-quality-gate-opus
> orchestrator-commit
> orchestrator-planner
> orchestrator-searcher-fast
> orchestrator-searcher
> mcp-search
> github
> ```
> 
> every time I type `@`. With no local directories on display, because everything is taken up by the subagents that aren't meant to be invoked by humans.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
