# neovim/neovim #32683 — fix(env.c): drop envmap, callers must free os_getenv() result

**[View PR on GitHub](https://github.com/neovim/neovim/pull/32683)**

| | |
|---|---|
| **Author** | @juditnovak |
| **Status** | ✅ merged |
| **Opened** | 2025-02-28 |
| **Repo** | curated review-culture seed |
| **Diff** | +281 / −146 across 26 files |
| **Engagement** | 25 conversation · 150 inline review comments |

## Top review comments (ranked by reactions)

### @juditnovak — 1 reactions  
`🚀 1`  ·  [link](https://github.com/neovim/neovim/pull/32683#issuecomment-2713219194)

> @justinmk Thank you very much for additional suggestions and most importantly the confirmation of the value of this work.
> I'm very glad it's useful :-)  
> Also thanks for the foreseen particularly careful review -- keeps me re-assured :-)
> 
> I carry on accordingly, evaluating cases for a potential `os_getenv_noalloc`. Thx very much :-)

### @juditnovak — 0 reactions  
`—`  ·  [link](https://github.com/neovim/neovim/pull/32683#issuecomment-2698247730)

> @justinmk Thanks for noticing my contribution here :-) 
> May I ask, what does the "needs:response" label stand for? I couldn't find a question (this PR, referred issue, etc.) but I wonder if it may have potential further meaning? Thx in advance.

### @juditnovak — 0 reactions  
`—`  ·  [link](https://github.com/neovim/neovim/pull/32683#issuecomment-2711531343)

> @justinmk Thanks very much for the review.
> 
> I had a question while working on this code. Isn't it an "overkill" to add the amount of (sensitive) changes to fix an --after all-- small issue? In case your judgement is to rather have this change, I'm more than happy to polish it to perfect :-)
> (I'm actively working on tracking down the issue of the windows pipeline.)

### @justinmk — 0 reactions  
`—`  ·  [link](https://github.com/neovim/neovim/pull/32683#issuecomment-2711951176)

> > Isn't it an "overkill" to add the amount of (sensitive) changes to fix an --after all-- small issue?
> 
> I wouldn't say https://github.com/neovim/neovim/issues/32550 is a small issue. It's pointing to a bug I had worried about, and could affect other libraries loaded by nvim.
> 
> `envmap` was never really a good solution, and I'm glad you are finally getting rid of it :) It's true that this work is delicate and will require careful review, but we don't really have an alternative.
> 
> I think `memfree` can be avoided in some of these cases. Also, if there are many cases that only want to quickly check the result of `os_getenv`, we could add `os_getenv_noalloc` which writes to `NameBuff` (and returns a pointer to it), to save the caller the trouble of freeing the result.

### @juditnovak — 0 reactions  
`—`  ·  [link](https://github.com/neovim/neovim/pull/32683#issuecomment-2715187280)

> Simple changes are applied, pipelines are :green_circle: :tada: 
> 
> Making an attempt for `os_getenv_noalloc` in an upcoming commit.

### @juditnovak — 0 reactions  
`—`  ·  [link](https://github.com/neovim/neovim/pull/32683#issuecomment-2717252307)

> @zeertzjq Thanks for your response. `os_env_exists` uses cool trick :-) 
> But I'm a bit confused, how to benefit from a similar approach here. Would you suggest to use `uv_os_getenv()` to retrieve the value to `NameBuff` directly? (I apologize if I'm overlooking something obvious...)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
