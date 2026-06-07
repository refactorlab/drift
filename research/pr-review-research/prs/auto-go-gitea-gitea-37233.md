# go-gitea/gitea #37233 — Frontend iframe renderer framework: 3D models, OpenAPI

**[View PR on GitHub](https://github.com/go-gitea/gitea/pull/37233)**

| | |
|---|---|
| **Author** | @silverwind |
| **Status** | ✅ merged |
| **Opened** | 2026-04-15 |
| **Repo importance** | ★56,132 · 6,774 forks · score 88,227 |
| **Diff** | +540 / −293 across 32 files |
| **Engagement** | 87 conversation · 37 inline review comments |

## Top review comments (ranked by reactions)

### @wxiaoguang — 1 reactions  
`🎉 1`  ·  [link](https://github.com/go-gitea/gitea/pull/37233#issuecomment-4270597482)

> The fix is quite simple and straightforward: use `iframe.srcdoc`

### @wxiaoguang — 1 reactions  
`😄 1`  ·  [link](https://github.com/go-gitea/gitea/pull/37233#issuecomment-4270736311)

> > > ~NOOOOOOOOO. By this, you will import everything.~
> > > I wrote that way, there must be a strong reason
> > 
> > Huh, seems like these statements are exactly equal, just a removal of a useless function wrapper. But ok, I will revert.
> 
> Hmm, this one is no problem. I remember that the Vite compiler has come quirks, this time it is right. I will take your syntax and add some comments.

### @silverwind — 1 reactions  
`👍 1`  ·  [link](https://github.com/go-gitea/gitea/pull/37233#issuecomment-4270780501)

> Given that padding/color is such a recurring issue, should add a assertion in the e2e for it. I can do after your fixes.

### @wxiaoguang — 0 reactions  
`—`  ·  [link](https://github.com/go-gitea/gitea/pull/37233#issuecomment-4251195246)

> But the problem is, the file extensions are ambiguous
> 
> Without frontend render's trial, backend doesn't know whether the file is really renderable.
> 
> That's why the old code "tries to render the 3d model, if fails, then hides the rendered button"
> 
> I think "Use Content-Seucrity-Policy: script nonce #37232" is good enough and safe enough (safer)

### @silverwind — 0 reactions  
`—`  ·  [link](https://github.com/go-gitea/gitea/pull/37233#issuecomment-4251207073)

> > Without frontend render's trial, backend doesn't know whether the file is really renderable.
> 
> I tested using a broken file and it rendered an error message. Is that not acceptable?

### @wxiaoguang — 0 reactions  
`—`  ·  [link](https://github.com/go-gitea/gitea/pull/37233#issuecomment-4251222021)

> > > Without frontend render's trial, backend doesn't know whether the file is really renderable.
> > 
> > I tested using a broken file and it rendered an error message? Is that not acceptable?
> 
> It means the existing logic is broken, but I don't think it means backend should blindly treat the plenty of potential ambiguous file extensions as 3D model.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
