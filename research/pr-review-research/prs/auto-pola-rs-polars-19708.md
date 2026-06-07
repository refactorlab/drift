# pola-rs/polars #19708 — feat: Add `dt.replace`

**[View PR on GitHub](https://github.com/pola-rs/polars/pull/19708)**

| | |
|---|---|
| **Author** | @mcrumiller |
| **Status** | ✅ merged |
| **Opened** | 2024-11-09 |
| **Repo** | curated review-culture seed |
| **Diff** | +823 / −64 across 14 files |
| **Engagement** | 14 conversation · 46 inline review comments |

## Top review comments (ranked by reactions)

### @adamreeve — 2 reactions  
`👍 2`  ·  [link](https://github.com/pola-rs/polars/pull/19708#issuecomment-2521278636)

> > Should the result be the date 2000-01-01, or should it remain null?
> 
> In my opinion, it should be null. Making a non-null result would be inconsistent and quite surprising.

### @MarcoGorelli — 2 reactions  
`🚀 1 · 😄 1`  ·  [link](https://github.com/pola-rs/polars/pull/19708#issuecomment-2557298482)

> There's been no objections, and I think this feature would be really ergonomic (and higher-perf than some current alternatives involving `strftime` / `strptime` string hacking), so I'd say let's ship it - thanks @mcrumiller !

### @mcrumiller — 1 reactions  
`👍 1`  ·  [link](https://github.com/pola-rs/polars/pull/19708#issuecomment-2468169029)

> > sure - would it work to start with
> > 
> > ```
> > datetime(2020, 10, 25)
> > ```
> > 
> > and then do `.dt.replace(hour=1)`?
> 
> Thanks--looks like I need to use `Europe/London` for this to work (found in another unit test).

### @mcrumiller — 1 reactions  
`👍 1`  ·  [link](https://github.com/pola-rs/polars/pull/19708#issuecomment-2518217875)

> > the coverage report looks a little concerning
> 
> You're right, looks like we're not hitting the `Date` path in the tests, only `Datetime`. Will fix, thanks.

### @mcrumiller — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19708#issuecomment-2466440096)

> @MarcoGorelli I could also perhaps use some help creating tests to cover the `non_existent` parameter and the `ambiguous` parameter, neither of which my tests cover.

### @MarcoGorelli — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19708#issuecomment-2466768075)

> > @MarcoGorelli I could also perhaps use some help creating tests to cover the `non_existent` parameter and the `ambiguous` parameter, neither of which my tests cover.
> 
> sure - would it work to start with
> ```
> datetime(2020, 10, 25)
> ```
> and then do `.dt.replace(hour=1)`?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
