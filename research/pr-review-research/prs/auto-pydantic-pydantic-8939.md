# pydantic/pydantic #8939 — Fix TypeAdapter to respect defer_build

**[View PR on GitHub](https://github.com/pydantic/pydantic/pull/8939)**

| | |
|---|---|
| **Author** | @MarkusSintonen |
| **Status** | ✅ merged |
| **Opened** | 2024-03-04 |
| **Repo** | curated review-culture seed |
| **Diff** | +644 / −130 across 14 files |
| **Engagement** | 21 conversation · 88 inline review comments |

## Top review comments (ranked by reactions)

### @MarkusSintonen — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/pydantic/pydantic/pull/8939#issuecomment-1978463584)

> With this our FastAPI initialization drops from ~40s to ~10s. Where core schema generation takes ~3-4s. This requires using `defer_build` in all the relevant places. This moves the core schema overhead to when API gets called. In real life its  mostly fine as not all the APIs are always active. Its ofcourse much nicer that a single test starts up much faster.

### @samuelcolvin — 2 reactions  
`👍 2`  ·  [link](https://github.com/pydantic/pydantic/pull/8939#issuecomment-2002449594)

> We'll discuss next week, but if it's helping you a lot and is opt in, I'm 👍.

### @MarkusSintonen — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/8939#issuecomment-2002529621)

> Thank you! This would indeed help. Atleast until there are optimizations/caching added to the CoreSchema generation. But probably implementing those are not happening in very near future

### @MarkusSintonen — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/8939#issuecomment-2002581349)

> > We'll discuss next week, but if it's helping you a lot and is opt in, I'm 👍.
> 
> I now made it an opt-in feature via the usual config object (instead of magical global flags as I originally suggested). See https://github.com/pydantic/pydantic/pull/8939/commits/7deb045d8222b9d1edb1ae34253d060ccf9d5275
> 
> Also documented the current and the opt-in behaviour there.

### @sydney-runkle — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/8939#issuecomment-2004029527)

> > We'll discuss next week, but if it's helping you a lot and is opt in, I'm 👍.
> 
> @MarkusSintonen, we chatted this morning - let's move forward with this 🚀. I know you've implemented support for this as an opt in feature. I think we'll want to add some documentation explaining that this is experimental, and subject to change. Ultimately, a better solution will be to have TA build times improve significantly so that your changes aren't super necessary.
> 
> I'll review thoroughly this afternoon :)

### @MarkusSintonen — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/8939#issuecomment-2008061526)

> > I'm going to take a closer look at the logic changes in `type_adapter.py`, but here's some general feedback on the new API :).
> 
> I still refactored it a bit into a smaller property functions with `@cached_property` which is much cleaner. (Only now remembered it was available already in Python3.8 this supports)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
