# python/cpython #124640 — GH-91048: Add utils for capturing async call stack for asyncio programs and enable profiling

**[View PR on GitHub](https://github.com/python/cpython/pull/124640)**

| | |
|---|---|
| **Author** | @1st1 |
| **Status** | ✅ merged |
| **Opened** | 2024-09-26 |
| **Repo importance** | ★73,094 · 34,706 forks · score 216,918 |
| **Diff** | +2915 / −233 across 23 files |
| **Engagement** | 62 conversation · 229 inline review comments |

## Top review comments (ranked by reactions)

### @pablogsal — 8 reactions  
`👍 8`  ·  [link](https://github.com/python/cpython/pull/124640#issuecomment-2427741781)

> > The major drawback of this approach is the logic to walk the graph is more complicated, and it is more annoying to work with from an external profiler (something I also really want).
> 
> The PR contains a test for an external profiler that proves that this is possible (`test_externalinspection`). We spent a considerable amount of time finding the right balance between ergonomics for external profilers and not changing core functionality of asyncio and the interpreter and we believe that the design we are going to use (the current one + the new changes that will be done soon) is the one that has the best balance here.
> 
> > I don't think that problem is intractable though. If we focus on getting the graph of `Task`s and `coroutine` objects then it should be possible to add some features to `_asynciomodule.c` to expose the data an external profiler would need. Most importantly we need a way to find the current task (which could be a global/TLS `PyObject*`), a reliable way to resolve that to the coroutine it's awaiting on (e.g. a fixed offset on a `Task` `PyObject*` instance), and then a way to get the "yield from" object from a `coroutine`. The last would probably still involve looking at the interpreter's stack pointer today, but if we're open to changing as needed then it should be fine.
> 
> We are changing this PR to implement most of what you are proposing. @ambv is working on the required changes:
> 
> * We are burning some special metadata in a section of the `_asynciomodule` shared objects that can be read similar to how the new debug offsets work. This metadata will contain debu … *[truncated]*

### @jbower-fb — 6 reactions  
`👍 3 · ❤️ 3`  ·  [link](https://github.com/python/cpython/pull/124640#issuecomment-2427825412)

> @pablogsal great! I'm glad I can finally purge this from the back of my mind. Overall really excited to hear this will be upstream with profiler support.

### @1st1 — 4 reactions  
`👍 4`  ·  [link](https://github.com/python/cpython/pull/124640#issuecomment-2411537425)

> @kumaraditya303
> 
> Hear hear.
> 
> > This PR adds 2k+ worth of changes and adds a new feature to asyncio whose maintenance status is not good. My understanding is that this feature will be used by very few users, I am not sure how I would use this myself atm. As such this adds a significant maintenance overhead for asyncio.
> 
> To be fair, more than half of those 2k+ changes is docs and tests.  I agree it will be used by very few users developing locally, at least initially.  But it'll be used by every serious asyncio user in production, because this will be the easiest way to profile & introspect asyncio code.  I have had a lot of asyncio users reaching out to me over the years asking how to deal with profiling and I never had a good answer, hopefully with this PR we finally will.
> 
> As for maintenance overhead I can't disagree, every new feature adds overhead. To this I can say two things: (1) I plan to be more active going forward and help; (2) let's not stop the evolution of asyncio because of maintenance concerns; if we do that then it will just stagnate and rot.
> 
> > IIUC this pr only supports tasks which inherit from the builtin asyncio task, and given that asyncio officially supports using custom task factory, I am sure later we will get requests to support other tasks implementations, how would that be handled?
> 
> Adding support for third-party tasks will be fairly trivial. However, Guido and I discussed this at length and he convinced me to start with the support of built-in tasks. The reasoning here is that most users don't create their Task implementations from scratch (it's v … *[truncated]*

### @1st1 — 4 reactions  
`🚀 4`  ·  [link](https://github.com/python/cpython/pull/124640#issuecomment-2496222355)

> OK, thanks to Pablo's investigation, we discovered that at least one negative performance impact was due to me changing the source code of `asyncio.gather()` to wrap one of the callback functions in a `lambda`, which significantly increased the number of objects the GC had to deal with.
> 
> I've updated my micro-benchmark to use `gather()` instead of `TaskGroup` and was able to see the 25% slowdown.
> 
> With the [updated bench](https://gist.github.com/1st1/a798be7abf2ebefb51ebf94d6be20295), `main` branch clocks 0.76s per iteration, and `stack` takes 0.90s.
> 
> I then did two things:
> 
> * Added `lambda`-wrapping of the callback to the `main` branch and observed the same slowdown of it. **This confirms that the slowdown isn't caused by the new APIs and tracking that this PR adds.**
> 
> * [Fixed the updated](https://github.com/python/cpython/pull/124640/commits/703ff4668e4b01b4ece27300c3e770301572db33) `gather()` in this branch to not use `lambda`, but instead just pass the necessary argument via a default value. That fixed the performance, which is now identical (for this micro-benchmark) to that of the `main` branch.

### @itamaro — 4 reactions  
`👍 4`  ·  [link](https://github.com/python/cpython/pull/124640#issuecomment-2496307237)

> to @gpshead 's question
> 
> > What is the difference between those `_tg` and non-`_tg` asyncio benchmarks? That particular performance regression seems pretty specific. _(perspective: still faster than 3.12 though)_
> 
> the `_tg` suffixed async tree benchmarks are variants using `TaskGroups`, while the non-tg-suffixed ones use `gather`.
> the observation that the gather-based benchmarks saw the large regression is consistent with @1st1 's investigation and fix.

### @1st1 — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/python/cpython/pull/124640#issuecomment-2417606306)

> @kumaraditya303 Kumar, thanks for a good and thorough review!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
