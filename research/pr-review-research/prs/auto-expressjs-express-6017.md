# expressjs/express #6017 — Update `cookie` semver lock to address CVE-2024-47764

**[View PR on GitHub](https://github.com/expressjs/express/pull/6017)**

| | |
|---|---|
| **Author** | @joshbuker |
| **Status** | ✅ merged |
| **Opened** | 2024-10-04 |
| **Repo importance** | ★69,098 · 23,601 forks · score 168,455 |
| **Diff** | +6 / −1 across 2 files |
| **Engagement** | 23 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @UlisesGascon — 7 reactions  
`👍 7`  ·  [link](https://github.com/expressjs/express/pull/6017#issuecomment-2396359550)

> I will prepare a release today/tomorrow that includes this PR and other things. 
> 
> @joshbuker are you willing to create another PR targeting branch `4.x` as suggested by @RobinTail ? That way we cover 4.x too :+1: Otherwise I can do the cherry pick once this is landed in `master`.

### @joshbuker — 5 reactions  
`👍 3 · ❤️ 2`  ·  [link](https://github.com/expressjs/express/pull/6017#issuecomment-2397539091)

> Sure, I can create a PR for the 4.x branch as well. Thanks for the ping @UlisesGascon, @kurt-apple.
> 
> **Edit:** Created https://github.com/expressjs/express/pull/6029

### @RobinTail — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/expressjs/express/pull/6017#issuecomment-2395651875)

> > it'd still be very useful to have it backported to v4
> 
> I agree. No doubt.
> It should be backported/cherry-picked into [`4.x` branch](https://github.com/expressjs/express/tree/4.x) after it's fixed in `master`.

### @shivarm — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/expressjs/express/pull/6017#issuecomment-2402770047)

> @UlisesGascon @blakeembrey I think we should use `v1.0.0` instead `0.7.1` see changelog-> https://github.com/jshttp/cookie/releases/tag/v1.0.0
> 
> I can provide a PR! if you agree?

### @NewEraCracker — 2 reactions  
`👍 2`  ·  [link](https://github.com/expressjs/express/pull/6017#issuecomment-2405660040)

> My take:
> - 0.7.2 for express 4
> - 1.0.0 for express 5
> 
> The breaking change of 1.0.0 is because it only supports node.js 18+ like express 5 only supports node.js 18+.
> 
> My two cents.

### @joshbuker — 1 reactions  
`👍 1`  ·  [link](https://github.com/expressjs/express/pull/6017#issuecomment-2395130932)

> @bjohansebas Updated the history file. If it doesn't look quite right, or you'd like to make other changes, maintainer edits on the PR are enabled. Thanks!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
