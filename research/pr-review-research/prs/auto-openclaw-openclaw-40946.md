# openclaw/openclaw #40946 — Matrix: replace legacy plugin with new implementation

**[View PR on GitHub](https://github.com/openclaw/openclaw/pull/40946)**

| | |
|---|---|
| **Author** | @gumadeiras |
| **Status** | ✅ merged |
| **Opened** | 2026-03-09 |
| **Repo importance** | ★376,882 · 78,749 forks · score 696,878 |
| **Diff** | +78 / −86 across 43 files |
| **Engagement** | 47 conversation · 71 inline review comments |

## Top review comments (ranked by reactions)

### @gumadeiras — 1 reactions  
`👍 1`  ·  [link](https://github.com/openclaw/openclaw/pull/40946#issuecomment-4024736780)

> > > slowing down Matrix feature development and diverging from the SDK surface needed for newer Matrix capabilities
> > 
> > Just out of curiosity: why do you think it's slowing Matrix feature development down? What does the SDK offer, what the current package doesn't have?
> 
> matrix-js-sdk is where latest Matrix client features land so to ideally support new features we can't rely on a slowly updated intermediary wrapper
> we want things like SAS/QR device verification, secret storage, cross-signing bootstrap, room-key backup restore/reset, relations, reactions, and thread metadata. these and other features are stable and land first on matrix-js-sdk.
> 
> in trying to fix a lot of these, and you can look at open issues/PRs on matrix-bot-sdk, lots of cross-signing issues, threads/reactions not working reliably, dependency replacement and security-related PRs ignored (they use some deprecated package versions). owning control over feature implementation just means we can iterate/fix faster and support any features we want
> 
> > 
> > I mainly want to highlight that you went with a fake indexeddb implementation in this repo, which is trusted to store encryption keys. It feels untested and highly vibe coded to me, whereas the `matrix-bot-sdk` brings a tested implementation for e2ee key storage along.
> > 
> 
> that's a fair point; matrix-bot-sdk does have a cleaner node persistence abstraction. the matrix-js-sdk rust crypto expectes indexeddb for persistent storage. outside of the browser and without indexeddb then everything is ephemeral and means creating a new device on every restart. so yes, usin … *[truncated]*

### @sibbl — 0 reactions  
`—`  ·  [link](https://github.com/openclaw/openclaw/pull/40946#issuecomment-4024407782)

> > slowing down Matrix feature development and diverging from the SDK surface needed for newer Matrix capabilities
> 
> Just out of curiosity: why do you think it's slowing Matrix feature development down? What does the SDK offer, what the current package doesn't have?
> 
> I mainly want to highlight that you went with a fake indexeddb implementation in this repo, which is trusted to store encryption keys. It feels untested and highly vibe coded to me, whereas the `matrix-bot-sdk` brings a tested implementation for e2ee key storage along.
> 
> Where do you specifically see the benefits of moving to the SDK?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
