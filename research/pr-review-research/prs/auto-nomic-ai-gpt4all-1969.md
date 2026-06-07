# nomic-ai/gpt4all #1969 — Complete revamp of model loading to allow for more discrete control

**[View PR on GitHub](https://github.com/nomic-ai/gpt4all/pull/1969)**

| | |
|---|---|
| **Author** | @manyoso |
| **Status** | ✅ merged |
| **Opened** | 2024-02-15 |
| **Repo importance** | ★77,357 · 8,323 forks · score 110,649 |
| **Diff** | +515 / −212 across 17 files |
| **Engagement** | 20 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @manyoso — 1 reactions  
`👍 1`  ·  [link](https://github.com/nomic-ai/gpt4all/pull/1969#issuecomment-1952726337)

> All of the above should be fixed with this newest version. Thanks for the quality review.

### @manyoso — 1 reactions  
`👍 1`  ·  [link](https://github.com/nomic-ai/gpt4all/pull/1969#issuecomment-1954274434)

> > Also, having multiple conversations with different models and switching between them causes long (few seconds long) "switching context" messages.
> 
> This has to do with the save/restore of context that can be slow under vulkan. We're looking at ways to speed it up.

### @cebtenzzre — 0 reactions  
`—`  ·  [link](https://github.com/nomic-ai/gpt4all/pull/1969#issuecomment-1947391432)

> What happened to the "Regenerate response" button?
> 
> I'm using the default font size of "small" on macOS.
> 
> <img width="1512" alt="Screenshot 2024-02-15 at 4 45 58 PM" src="https://github.com/nomic-ai/gpt4all/assets/14168726/1bcb0b18-bf41-420c-9008-cfb79ab2ee0b">

### @cebtenzzre — 0 reactions  
`—`  ·  [link](https://github.com/nomic-ai/gpt4all/pull/1969#issuecomment-1947399276)

> Also, any idea what happened here? I unloaded Mini Orca (Small) and then tried to switch to a different model.
> 
> <img width="1512" alt="Screenshot 2024-02-15 at 4 51 45 PM" src="https://github.com/nomic-ai/gpt4all/assets/14168726/3d702798-4ec5-40e1-8f11-2cf2b0e90c52">

### @cebtenzzre — 0 reactions  
`—`  ·  [link](https://github.com/nomic-ai/gpt4all/pull/1969#issuecomment-1947404840)

> Also, attempting to switch models while a model is loading is allowed - it changes the model name but not the progress value, and it ends up queueing a series of model loads. We should either abort the model load via the progress callback, or prevent the user from doing this.

### @cebtenzzre — 0 reactions  
`—`  ·  [link](https://github.com/nomic-ai/gpt4all/pull/1969#issuecomment-1947413515)

> Is this dialog still necessary, when selecting a model that previously failed to load? Especially the "Model loading error..." at the top.
> 
> <img width="1624" alt="Screenshot 2024-02-15 at 5 03 04 PM" src="https://github.com/nomic-ai/gpt4all/assets/14168726/3cfd4fa2-8872-4cb9-8ec0-51c80a1b3a39">


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
