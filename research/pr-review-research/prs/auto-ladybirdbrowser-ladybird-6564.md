# LadybirdBrowser/ladybird #6564 — LibCrypto+AK: Merge LibCrypto/SecureRandom into AK/Random

**[View PR on GitHub](https://github.com/LadybirdBrowser/ladybird/pull/6564)**

| | |
|---|---|
| **Author** | @colleirose |
| **Status** | ✅ merged |
| **Opened** | 2025-10-23 |
| **Repo importance** | ★63,802 · 3,076 forks · score 81,104 |
| **Diff** | +99 / −104 across 15 files |
| **Engagement** | 28 conversation · 75 inline review comments |

## Top review comments (ranked by reactions)

### @gmta — 1 reactions  
`👍 1`  ·  [link](https://github.com/LadybirdBrowser/ladybird/pull/6564#issuecomment-3442654069)

> > Why is the windows workflow not running?
> 
> Because CI does not run automatically for new contributors. I'm waiting with approval until the compilation errors on Linux have been fixed.

### @gmta — 0 reactions  
`—`  ·  [link](https://github.com/LadybirdBrowser/ladybird/pull/6564#issuecomment-3441546190)

> @colleirose CI is failing; please make sure everything compiles locally.

### @R-Goc — 0 reactions  
`—`  ·  [link](https://github.com/LadybirdBrowser/ladybird/pull/6564#issuecomment-3442652325)

> Why is the windows workflow not running?

### @colleirose — 0 reactions  
`—`  ·  [link](https://github.com/LadybirdBrowser/ladybird/pull/6564#issuecomment-3443707210)

> > Because CI does not run automatically for new contributors. I'm waiting with approval until the compilation errors on Linux have been fixed.
> 
> I didn't experience compilation errors on Linux but I will apply the requested changes once I'm free and check again that it all compiles correctly. I will also test in a Windows VM to make sure that the code works correctly there too, I probably should have thought of that earlier.

### @rgret-dev — 0 reactions  
`—`  ·  [link](https://github.com/LadybirdBrowser/ladybird/pull/6564#issuecomment-3446863174)

> I'm not a huge fan of this change for the following reasons:
> 
> 1. We lose the explicitness in code (e.g. `fill_with_random` vs `fill_with_secure_random`)
> 2. CSPRNGs are fast, but still more complex and generally slower than PRNGs
> 
> I'm not a maintainer, but I think we should keep a dedicated CSPRNG in LibCrypto and potentially remove AK/Random until a high-performance PRNG is actually needed. Unless I missed something, the conversation with Jelle on discord also says something similar:
> 
> > You'd have two different classes for two different purposes, regardless of their current implementation

### @R-Goc — 0 reactions  
`—`  ·  [link](https://github.com/LadybirdBrowser/ladybird/pull/6564#issuecomment-3446908735)

> > I'm not a huge fan of this change for the following reasons:
> > 
> > 1. We lose the explicitness in code (e.g. `fill_with_random` vs `fill_with_secure_random`)
> > 2. CSPRNGs are fast, but still more complex and generally slower than PRNGs
> > 
> > I'm not a maintainer, but I think we should keep a dedicated CSPRNG in LibCrypto and potentially remove AK/Random until a high-performance PRNG is actually needed.
> 
> Indeed we do lose the more explicit naming, however the quality shouldn't go down? I can read into whatever openssl is doing and see. 
> 
> We don't need this to be the fastest thing on the planet. I was already able to get gigabytes per second of throughput with the windows implementation, I believe Linux shouldn't be far behind if at all. Writing a fast PRNG is also not trivial and usually needs intrinsics. 
> 
> We cannot remove AK/Random as there are things that cannot depend on LibCrypto and need a random function.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
