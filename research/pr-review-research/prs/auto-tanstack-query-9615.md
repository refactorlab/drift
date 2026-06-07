# TanStack/query #9615 — feat(query-core): add context to mutationfn & mutation callbacks

**[View PR on GitHub](https://github.com/TanStack/query/pull/9615)**

| | |
|---|---|
| **Author** | @joshuaellis |
| **Status** | ✅ merged |
| **Opened** | 2025-09-03 |
| **Repo importance** | ★49,637 · 3,868 forks · score 70,087 |
| **Diff** | +843 / −478 across 50 files |
| **Engagement** | 19 conversation · 36 inline review comments |

## Top review comments (ranked by reactions)

### @joshuaellis — 1 reactions  
`👀 1`  ·  [link](https://github.com/TanStack/query/pull/9615#issuecomment-3253768476)

> Made all the amends @TkDodo so this is ready for another review when you have time.

### @joshuaellis — 1 reactions  
`👍 1`  ·  [link](https://github.com/TanStack/query/pull/9615#issuecomment-3258459694)

> @TkDodo this is ready for review, i've looked at the tests and got the CI green 👍🏼

### @joshuaellis — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/TanStack/query/pull/9615#issuecomment-3266199779)

> I like it, explicit. Agreed, if it were an object it'd be a mouthful but positionally & for documentation wise its clear. I'll make that change.

### @joshuaellis — 0 reactions  
`—`  ·  [link](https://github.com/TanStack/query/pull/9615#issuecomment-3258585872)

> > It can be passed as an argument to mutations. So, we need to find a different name again 😅
> 
> We could append `localX` to something? alternatively it could be `state` since its scoped to the mutation?

### @joshuaellis — 0 reactions  
`—`  ·  [link](https://github.com/TanStack/query/pull/9615#issuecomment-3258594316)

> Or `environment` maybe? but that's a common paradigm already used in development practice

### @TkDodo — 0 reactions  
`—`  ·  [link](https://github.com/TanStack/query/pull/9615#issuecomment-3258596974)

> > > It can be passed as an argument to mutations. So, we need to find a different name again 😅
> > 
> > We could append `localX` to something? alternatively it could be `state` since its scoped to the mutation?
> 
> we also have a `MutationState` already. `mutateState` might work because it comes from “onMutate”, but it could still be confused with the `mutate` function. `environment` is too broad imo.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
