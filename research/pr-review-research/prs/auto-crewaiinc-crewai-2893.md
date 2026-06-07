# crewAIInc/crewAI #2893 — Changed Mem0 Storage v1.1 -> v2

**[View PR on GitHub](https://github.com/crewAIInc/crewAI/pull/2893)**

| | |
|---|---|
| **Author** | @Vidit-Ostwal |
| **Status** | ✅ merged |
| **Opened** | 2025-05-23 |
| **Repo importance** | ★52,895 · 7,383 forks · score 87,423 |
| **Diff** | +182 / −118 across 3 files |
| **Engagement** | 27 conversation · 30 inline review comments |

## Top review comments (ranked by reactions)

### @lucasgomide — 2 reactions  
`👍 2`  ·  [link](https://github.com/crewAIInc/crewAI/pull/2893#issuecomment-3024092535)

> @Dev-Khant Could you help us verify that this update is safe for Mem0 v2?

### @rusXL — 1 reactions  
`😕 1`  ·  [link](https://github.com/crewAIInc/crewAI/pull/2893#issuecomment-2908122096)

> And no, you did not really change mem0 v1.1 -> v2

### @Vidit-Ostwal — 1 reactions  
`👍 1`  ·  [link](https://github.com/crewAIInc/crewAI/pull/2893#issuecomment-2915413192)

> Hi @rusXL, do let me know your thoughts on the new codebase?

### @Vidit-Ostwal — 1 reactions  
`👍 1`  ·  [link](https://github.com/crewAIInc/crewAI/pull/2893#issuecomment-2977033994)

> > @Vidit-Ostwal Is this change backward compatible with Mem0 v2? Will users currently using v1 be impacted after updating their crewai package..
> 
> Ideally no, the function definition haven't changed, parameters have changed a bit, but we were handling those beforehand any way, so that also is nulled out.
> 
> The only thing was do we have the version of mem0 which has all this functionalities,
> 
> https://github.com/mem0ai/mem0/releases?page=2
> v.0.1.92 confirms that they have mem0v2
> 
> Requesting a review from @Dev-Khant, for safety.

### @Dev-Khant — 1 reactions  
`👍 1`  ·  [link](https://github.com/crewAIInc/crewAI/pull/2893#issuecomment-3066614236)

> Hi @Vidit-Ostwal got it, the rest looks good to me.

### @lucasgomide — 1 reactions  
`👍 1`  ·  [link](https://github.com/crewAIInc/crewAI/pull/2893#issuecomment-3089740803)

> I'm not sure, but I guess we did that to make it faster and have a full control about what is being stored.. From what I understood this feature analyse the input and generate the value to be stored. 
> 
> I think we could keep it as is.  Unless @Dev-Khant has any concern about it. Let me know, pls!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
