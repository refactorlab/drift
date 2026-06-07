# vuejs/core #11797 — fix(reactivity): prevent endless recursion in computed getters

**[View PR on GitHub](https://github.com/vuejs/core/pull/11797)**

| | |
|---|---|
| **Author** | @lehni |
| **Status** | ✅ merged |
| **Opened** | 2024-09-03 |
| **Repo** | curated review-culture seed |
| **Diff** | +46 / −1 across 2 files |
| **Engagement** | 25 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @yyx990803 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/vuejs/core/pull/11797#issuecomment-2331218369)

> @lehni that is indeed another behavior change from 3.4. I will address it in a separate commit.

### @lehni — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/vuejs/core/pull/11797#issuecomment-2331269093)

> @yyx990803 amazing, thank you for working on this so swiftly!

### @onlime — 2 reactions  
`🎉 2`  ·  [link](https://github.com/vuejs/core/pull/11797#issuecomment-2332143770)

> Great @lehni & @yyx990803 Thanks for the fast fix! The endless recursion also occurred in [floating-vue](https://github.com/Akryum/floating-vue) tooltips, fixed with Vue 3.5.2

### @yyx990803 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/vuejs/core/pull/11797#issuecomment-2338560151)

> @lehni ok in that case we should re-revert it then 😅

### @charlesg99 — 1 reactions  
`👍 1`  ·  [link](https://github.com/vuejs/core/pull/11797#issuecomment-2338586723)

> Thank you! Of course the real app is more complex and doesn't have a self referencing computed (directly that is, probably internally with object proxies or something). The computed causing problem with 3.5.3 uses a bunch of other computed and is passed throught props and such, so hard to pinpoint the exact cause and create a simple repro. 
> 
> All I know is that this piece of code is 4 years old (originally Vue version 2, now version 3) and has worked fine till version 3.5 broke production. So "something" changed that has worked the last 4 years :)

### @yyx990803 — 0 reactions  
`—`  ·  [link](https://github.com/vuejs/core/pull/11797#issuecomment-2328863349)

> This doesn't seem to break anything but it would be ideal to have a minimal test case so we better understand what kind of usage leads to need of this fix.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
