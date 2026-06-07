# typst/typst #4587 — Unified and fixed `Duration` formatting in the CLI

**[View PR on GitHub](https://github.com/typst/typst/pull/4587)**

| | |
|---|---|
| **Author** | @Andrew15-5 |
| **Status** | ✅ merged |
| **Opened** | 2024-07-20 |
| **Repo importance** | ★54,010 · 1,592 forks · score 65,373 |
| **Diff** | +280 / −32 across 5 files |
| **Engagement** | 15 conversation · 102 inline review comments |

## Top review comments (ranked by reactions)

### @laurmaedje — 1 reactions  
`👍 1`  ·  [link](https://github.com/typst/typst/pull/4587#issuecomment-2370683938)

> I think yes. It can be useful and it doesn't hurt.

### @Andrew15-5 — 1 reactions  
`👍 1`  ·  [link](https://github.com/typst/typst/pull/4587#issuecomment-2387243559)

> As to blocking, I'm busy with a lot of stuff, including Typst Forum. But perhaps I will have more time for source code contribution soon (maybe even tomorrow).

### @Andrew15-5 — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/4587#issuecomment-2254654223)

> I don't know which style of testing is better. I rarely made tests and always struggle with "concise vs. readable vs. maintainable" type of thing.

### @Andrew15-5 — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/4587#issuecomment-2291389171)

> One thing I'm not really sure is the order of `pub`/non-`pub` functions in [here](https://github.com/typst/typst/pull/4587/files#diff-8b050b218f83192727292deff17a26bde7d134563d7a09d381f92f3a80c3b775). Other than that, it looks more or less complete.

### @Andrew15-5 — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/4587#issuecomment-2299787479)

> I was feeling a bit fancy, so I added a few code examples to the public functions. They pass too.
> 
> To be honest, I will almost always choose some code examples over documentation (because write — first, debug/read — second). Documentation would be just a bonus.

### @laurmaedje — 0 reactions  
`—`  ·  [link](https://github.com/typst/typst/pull/4587#issuecomment-2368118630)

> > Note: if duration is 1 second or longer, then output will be identical to [time_starting_with_seconds], which also means that precision, number of milliseconds and microseconds will not be used.
> 
> Why is it this way? Compile will now say 2s or 3s rather than an exact amount, which is not great. Surfaced here: https://discord.com/channels/1054443721975922748/1088371867913572452/1287441738239054036


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
