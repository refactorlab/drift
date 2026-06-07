# redis/redis #14680 — Add hotkeys detection

**[View PR on GitHub](https://github.com/redis/redis/pull/14680)**

| | |
|---|---|
| **Author** | @minchopaskal |
| **Status** | ✅ merged |
| **Opened** | 2026-01-09 |
| **Repo importance** | ★74,704 · 24,653 forks · score 178,313 |
| **Diff** | +2401 / −7 across 14 files |
| **Engagement** | 26 conversation · 193 inline review comments |

## Top review comments (ranked by reactions)

### @tezc — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14680#issuecomment-3732784193)

> @minchopaskal I had a quick pass over the PR and left a few minor comments. I assume the API is not final yet so we don't have more details about the commands in the top comment. e.g. what is SLOTS or SAMPLE. I assume we also don't have more tests because of this. 
> 
> Regarding cuckoo impl, maybe it is a good idea to add some comments over each function (only to important ones) to describe what it is doing. So, people who have no idea about the algorithm will be a chance to understand what is going on.

### @sundb — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14680#issuecomment-3743381460)

> I'm thinking about if we can add a new hotkey.c file and put both the chk.c and hotkey commands in that file. It doesn't seem appropriate to put them in server.c. server.c already has over 7000 lines and is too large.

### @minchopaskal — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14680#issuecomment-3743758476)

> > I'm thinking about if we can add a new hotkey.c file and put both the chk.c and hotkey commands in that file. It doesn't seem appropriate to put them in server.c. server.c already has over 7000 lines and is too large.
> 
> maybe hotkey.c is a good idea, but let chk.c stay separate as we can use it as a general top K structure.

### @sundb — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14680#issuecomment-3743810566)

> > > I'm thinking about if we can add a new hotkey.c file and put both the chk.c and hotkey commands in that file. It doesn't seem appropriate to put them in server.c. server.c already has over 7000 lines and is too large.
> > 
> > maybe hotkey.c is a good idea, but let chk.c stay separate as we can use it as a general top K structure.
> 
> no objection for it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
