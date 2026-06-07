# rails/rails #51674 — Add `Parameters#expect` to safely filter and require params

**[View PR on GitHub](https://github.com/rails/rails/pull/51674)**

| | |
|---|---|
| **Author** | @martinemde |
| **Status** | ✅ merged |
| **Opened** | 2024-04-27 |
| **Repo** | curated review-culture seed |
| **Diff** | +1031 / −153 across 33 files |
| **Engagement** | 85 conversation · 45 inline review comments |

## Top review comments (ranked by reactions)

### @dhh — 2 reactions  
`👍 2`  ·  [link](https://github.com/rails/rails/pull/51674#issuecomment-2319182416)

> I was also just thinking that expect! would catch and reraise. I hadn't considered distinguishing between missing vs wrong type. I'm skeptical that's necessary.

### @rafaelfranca — 1 reactions  
`👍 1`  ·  [link](https://github.com/rails/rails/pull/51674#issuecomment-2263359677)

> Let's move on with this one. @dhh already reviewed the API and said it looks promising.
> 
> Can you write tests for it and prefer using it to `require.permit` in the guides?

### @martinemde — 1 reactions  
`👍 1`  ·  [link](https://github.com/rails/rails/pull/51674#issuecomment-2266363066)

> I'm pushing up work as I finish. Thanks for the feedback. Should have it done soon. (I'll squash when it's ready)
> 
> As I've been working on this I thought of an alternate name. What do you think?
> 
> ```ruby
> params.expect(person: %i[name, age])
> ```
> 
> After typing mandate over and over, I'm not totally in love with it, but I don't feel strongly.

### @dari-us — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rails/rails/pull/51674#issuecomment-2271082862)

> @martinemde 
> I made changes to Parameters, which passes all the tests (except `keys to arrays: return permitted params in hash key order`, which I disagree with, see [my comment](https://github.com/rails/rails/commit/91e3d0b13f8ab6af4a638b12114c6428cdc6edcf#r145073367)). I don't know how to contribute "the right way" or if it is too early for that, but this is what I've come up with:
> 
> https://github.com/dari-us/rails/compare/main...dari-us-implement-safe-parameter-filtering#diff-99dab0dfb4d0cfa044997480d5aa1b100dc60347a10cedd6d8f7a0395f6a6efd
> 
> Feel free to incorporate / beautify this
> 
> Edit: There are no tests yet for `permit_only`, `expect_only`, `allow`, and `allow_only`, I've only "tested" them locally in a console session.

### @dari-us — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rails/rails/pull/51674#issuecomment-2273392088)

> @martinemde 
> I updated my code to incorporate your suggestion to explicity `expect`, `allow` Array-like structures, see again:
> 
> https://github.com/dari-us/rails/compare/main...dari-us-implement-safe-parameter-filtering#diff-99dab0dfb4d0cfa044997480d5aa1b100dc60347a10cedd6d8f7a0395f6a6efd
> 
> I introduced `safe_hash_filter`, `safe_actionable_permit`, `array_of_filters?` to account for explicit Array-like structures

### @martinemde — 1 reactions  
`👍 1`  ·  [link](https://github.com/rails/rails/pull/51674#issuecomment-2276026293)

> @dari-us I've mostly integrated your update into my branch locally. It's not quite passing yet though.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
