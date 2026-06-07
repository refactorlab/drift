# pydantic/pydantic #9459 — Add pipeline API

**[View PR on GitHub](https://github.com/pydantic/pydantic/pull/9459)**

| | |
|---|---|
| **Author** | @adriangb |
| **Status** | ✅ merged |
| **Opened** | 2024-05-20 |
| **Repo** | curated review-culture seed |
| **Diff** | +1201 / −9 across 13 files |
| **Engagement** | 25 conversation · 107 inline review comments |

## Top review comments (ranked by reactions)

### @sydney-runkle — 2 reactions  
`👍 2`  ·  [link](https://github.com/pydantic/pydantic/pull/9459#issuecomment-2141918191)

> > But validation and serialization are very intertwined in pydantic.
> 
> Sigh, indeed. 
> 
> > Do we need to think about serialization at all here? Currently this is an API to customize validation. So do we need to address that now or can it be tabled?
> 
> I'm fine with tabling this for now, but I think we'd need to decide on this before moving this feature out of its experimental phase.

### @sydney-runkle — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/9459#issuecomment-2142169734)

> I used `typing.Pattern` instead of `re.Pattern` like we do [here](https://github.com/pydantic/pydantic/pull/9053/files) for 3.8 compatibility.

### @adriangb — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/9459#issuecomment-2143735645)

> > A thought, is there something similar we should be doing for serialization? Can this API be elegantly combined with serialization?
> 
> https://github.com/pydantic/pydantic/pull/9459#issuecomment-2141918191

### @adriangb — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/9459#issuecomment-2147657362)

> > can we have a link here to the API docs for the thing returned by parse.
> > I also think we should add a bit of explanation of how the pipeline api works.
> 
> > we should also update the test that checks nothing from _internal is available to import publicly.
> 
> @sydney-runkle could you handle these?
> 
> The only other thing left is bikeshedding the `pipe()` name.

### @adriangb — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/9459#issuecomment-2150671003)

> @sydney-runkle the changes to make `validate_as(...)` work seem to have broken type checking: `validate_as(str).transform(lambda x: x + 1)` no longer fails type checking because `x` is `Any`

### @adriangb — 1 reactions  
`👍 1`  ·  [link](https://github.com/pydantic/pydantic/pull/9459#issuecomment-2152340164)

> @sydney-runkle I have a couple of followup ideas but I think we should merge this and iterate from there


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
