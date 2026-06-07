# python/cpython #137215 — gh-137026: Add an explainer guide for asyncio

**[View PR on GitHub](https://github.com/python/cpython/pull/137215)**

| | |
|---|---|
| **Author** | @anordin95 |
| **Status** | ✅ merged |
| **Opened** | 2025-07-29 |
| **Repo importance** | ★73,094 · 34,706 forks · score 216,918 |
| **Diff** | +617 / −0 across 5 files |
| **Engagement** | 24 conversation · 539 inline review comments |

## Top review comments (ranked by reactions)

### @Yhg1s — 4 reactions  
`👍 4`  ·  [link](https://github.com/python/cpython/pull/137215#issuecomment-3188039159)

> One minor nit, as I run across this PR while reviewing changes in 3.13: When merging a change, please, please, please do not use the default github merge message. Replace it with the PR description or a similarly focused, singular message -- or at the very least remove the long list of commits from the message. The merge message is the one that shows up in the git log and it's *much* more useful if it's focused and short.

### @AA-Turner — 3 reactions  
`❤️ 1 · 🎉 2`  ·  [link](https://github.com/python/cpython/pull/137215#issuecomment-3170683989)

> Congratulations @anordin95; a special thank you to @ZeroIntensity, @willingc, and the other reviewers for getting this over the line!
> 
> A

### @ZeroIntensity — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/python/cpython/pull/137215#issuecomment-3152523609)

> Let's just use the `DO-NOT-MERGE` label. If I or any other core dev approves after after you hit "request changes", the bot still switches it to "awaiting merge".

### @willingc — 2 reactions  
`👍 2`  ·  [link](https://github.com/python/cpython/pull/137215#issuecomment-3166076370)

> > This is based on the concept of [lies-to-children](https://en.wikipedia.org/wiki/Lie-to-children) ("a simplified, and often technically incorrect, explanation of technical or complex subjects employed as a teaching method"). This tutorial is targeted towards beginners, so it should be totally OK to use some information that's technically incorrect in the pursuit of initial comprehension.
> 
> Thanks @ZeroIntensity and @anordin95. HOWTO guides are not strictly targeted to beginners rather they are a deeper explanation of something. The name HOWTO comes from early Linux days as a deep dive into a particular area.
> 
> OK, we are down to one key decision: the best mental model for an event loop. We've been discussing a) the queue and b) the execution of scheduled work.
> 
> > Event loops run asynchronous tasks and callbacks, perform network IO operations, and run subprocesses.
> 
> From the event loop docs, the above defines work run by an event loop. I'm going to suggest that instead of sticking with "queue" which doesn't sit well with multiple asyncio maintainers that we explore some other terms: "to do list", "work checklist", "collection of work".
> 
> Working from the conductor metaphor: 
> 
> Like a symphony conductor, the event loop orchestrates multiple performers (tasks). It knows when each section should play, pauses some while others perform, and coordinates the overall harmony of concurrent operations.

### @anordin95 — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/python/cpython/pull/137215#issuecomment-3170389416)

> Many of these comments were thoughtful, respectful and justified. However, I experienced some of them as more  commanding or condescending rather than collaborative. They ultimately made the process a tad unpleasant and I’m hesitant to return for a second contribution. Both things are certainly far from the end of the world! I just wanted to offer my candid perspective and feedback.

### @anordin95 — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/137215#issuecomment-3141184562)

> For comments that have been addressed (and the original commenter is satisfied with the resolution) could the original commenter "Mark as Resolved"? That way, we can minimize clutter to focus on what remains.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
