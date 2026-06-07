# ghostty-org/ghostty #3931 — Added snap packaging

**[View PR on GitHub](https://github.com/ghostty-org/ghostty/pull/3931)**

| | |
|---|---|
| **Author** | @kenvandine |
| **Status** | ✅ merged |
| **Opened** | 2024-12-29 |
| **Repo importance** | ★55,978 · 2,849 forks · score 72,369 |
| **Diff** | +237 / −0 across 5 files |
| **Engagement** | 42 conversation · 26 inline review comments |

## Top review comments (ranked by reactions)

### @kenvandine — 3 reactions  
`👍 3`  ·  [link](https://github.com/ghostty-org/ghostty/pull/3931#issuecomment-2576211595)

> I've requested permission for classic confinement at https://forum.snapcraft.io/t/request-classic-confinement-for-ghostty/44523

### @mitchellh — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/ghostty-org/ghostty/pull/3931#issuecomment-2660970099)

> Tests are green! I moved the env var setting from termio to the apprt since that's where they go now.
> 
> One more green run and I'll merge this then we can consider release management and other things in future work.
> 
> Thank you @kenvandine

### @kenvandine — 2 reactions  
`👍 1 · 🚀 1`  ·  [link](https://github.com/ghostty-org/ghostty/pull/3931#issuecomment-2660981368)

> > Tests are green! I moved the env var setting from termio to the apprt since that's where they go now.
> > 
> > One more green run and I'll merge this then we can consider release management and other things in future work.
> > 
> > Thank you @kenvandine 
> 
> That's awesome! I think the snap is in pretty good shape, I've tested on several Ubuntu versions, Debian 11 and 12, and fedora 41 myself.

### @kenvandine — 1 reactions  
`🚀 1`  ·  [link](https://github.com/ghostty-org/ghostty/pull/3931#issuecomment-2603830503)

> @mitchellh, I am really happy with the state of the snap now, so from my perspective, this is ready to land whenever you are ready for that. Once this is merged, we can chat about the process to transfer the snap over to you in the store and get automated builds going.

### @kenvandine — 1 reactions  
`👍 1`  ·  [link](https://github.com/ghostty-org/ghostty/pull/3931#issuecomment-2634320823)

> > * https://github.com/ghostty-org/ghostty/releases/tag/v1.1.0 has been released 5 days ago
> > * https://snapcraft.io/ghostty is at `latest/stable 1.0.2-tip-675-g4da51fa5`
> > 
> > I don't understand how snap packaging actually works and I don't expect same day updates to the snap, but please update it.
> 
> This will be automated once this PR is merged, but in the mean time I need to rebase which I've been avoiding because it caused some issues in the git history. I'll carefully do that now to get ghostty in the store updated.

### @mitchellh — 1 reactions  
`👍 1`  ·  [link](https://github.com/ghostty-org/ghostty/pull/3931#issuecomment-2637736658)

> And just to note, I'm waiting on the upstream issue to get resolved in snap, otherwise our CI is flaky (and fails more than 50% of the time for me) due to the snap race condition. That's the major blocker now.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
