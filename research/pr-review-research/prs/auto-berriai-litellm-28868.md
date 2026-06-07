# BerriAI/litellm #28868 — feat(context_management): compact_20260112 polyfill for non-Anthropic providers

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/28868)**

| | |
|---|---|
| **Author** | @Sameerlite |
| **Status** | ✅ merged |
| **Opened** | 2026-05-26 |
| **Repo importance** | ★49,453 · 8,643 forks · score 89,007 |
| **Diff** | +6202 / −102 across 28 files |
| **Engagement** | 41 conversation · 110 inline review comments |

## Top review comments (ranked by reactions)

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/BerriAI/litellm/pull/28868#issuecomment-4543936126)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/BerriAI/litellm?pullRequest=28868) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you all sign our [Contributor License Agreement](https://cla-assistant.io/BerriAI/litellm?pullRequest=28868) before we can accept your contribution.<br/>**2** out of **3** committers have signed the CLA.<br/><br/>:white_check_mark: mateo-berri<br/>:white_check_mark: Sameerlite<br/>:x: cursoragent<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/BerriAI/litellm?pullRequest=28868) it.</sub>

### @krrish-berri-2 — 0 reactions  
`—`  ·  [link](https://github.com/BerriAI/litellm/pull/28868#issuecomment-4556428783)

> @Sameerlite — a couple of small asks before review:
> 
> 1. The `lint` CI check is failing and looks related to the changes in this PR. Could you take a look and get it green?
> 2. Could you also add a screenshot or short demo showing the `compact_20260112` polyfill working on a non-Anthropic provider? It really helps reviewers verify the change quickly.
> 
> Thanks!

### @mateo-berri — 0 reactions  
`—`  ·  [link](https://github.com/BerriAI/litellm/pull/28868#issuecomment-4557250229)

> Continuing the convo from here: https://github.com/BerriAI/litellm/pull/28779#issuecomment-4554352500
> 
> > I agree with you, my only concern is that this feat doesn't break stuff for people. Drop params is an easy way out if it does. I say, we get this feat out, and then once we can see it is in a stable and no issues are coming, we add this param is supported params. DOes this work?
> 
> OK, I'm aligned on this approach. Let's revisit this in 2 weeks time to see if there are any issues coming in after getting promoted to stable


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
