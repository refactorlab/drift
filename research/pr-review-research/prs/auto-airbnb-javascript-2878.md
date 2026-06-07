# airbnb/javascript #2878 — remove object.entries dependency

**[View PR on GitHub](https://github.com/airbnb/javascript/pull/2878)**

| | |
|---|---|
| **Author** | @43081j |
| **Status** | ✅ merged |
| **Opened** | 2024-01-04 |
| **Repo importance** | ★148,108 · 26,661 forks · score 259,073 |
| **Diff** | +35 / −28 across 7 files |
| **Engagement** | 20 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @43081j — 13 reactions  
`👍 13`  ·  [link](https://github.com/airbnb/javascript/pull/2878#issuecomment-1881487276)

> do you want to introduce patches for the following then too:
> 
> - `Array.isArray`
> - `Array.prototype.concat`
> - `Array.prototype.indexOf`
> - `Array.prototype.forEach`
> 
> we can also `delete` all of those in an equally far fetched edge case.
> 
> it is a "none of them or all of them" situation. so if we're not going to do that, the benefit you mentioned isn't so relevant and we can probably move ahead with this.

### @kibertoad — 9 reactions  
`👍 9`  ·  [link](https://github.com/airbnb/javascript/pull/2878#issuecomment-1881878958)

> There is an almost infinite set of not impossible crazy things a user might do. However, since ESLint is executed from CLI, it is exceedingly improbable anyone will invent a crazy ESLint hook just to break their own pipeline. And if they go to that length, which cannot be accidental, why stop them?

### @ljharb — 3 reactions  
`👎 3`  ·  [link](https://github.com/airbnb/javascript/pull/2878#issuecomment-1881401296)

> The benefit of keeping it around is that `delete Object.entries` won't break it.

### @ljharb — 1 reactions  
`👎 1`  ·  [link](https://github.com/airbnb/javascript/pull/2878#issuecomment-1879843176)

> This does happen to be one of the few builtin methods that shipped without bugs. What's the benefit of removing the dep tho? It'll already just use the native function, but in a way that's robust against other plugins mutating globals.

### @ljharb — 1 reactions  
`👍 1`  ·  [link](https://github.com/airbnb/javascript/pull/2878#issuecomment-1881690871)

> You dont have to worry about those failures; I'll fix that myself before landing any PRs.

### @43081j — 1 reactions  
`👍 1`  ·  [link](https://github.com/airbnb/javascript/pull/2878#issuecomment-1881882550)

> indeed @kibertoad is correct. by keeping this package around, we're covering the case of a consumer installing an eslint plugin in parallel to this config which mutates globals in an invalid way
> 
> not impossible, true, but probably hasn't been seen in your lifetime (would love to see an example if i'm wrong there).
> 
> similarly, all other globals, prototypes and even the ESLint API you use can have been modified the same way. do you intend on wrapping each of those in your own functions? no more direct interaction with the ESLint API, no more array prototype methods, no global namespaces.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
