# pola-rs/polars #19894 — feat: Add `index_of()` function to `Series` and `Expr`

**[View PR on GitHub](https://github.com/pola-rs/polars/pull/19894)**

| | |
|---|---|
| **Author** | @itamarst |
| **Status** | ✅ merged |
| **Opened** | 2024-11-20 |
| **Repo** | curated review-culture seed |
| **Diff** | +619 / −0 across 20 files |
| **Engagement** | 27 conversation · 36 inline review comments |

## Top review comments (ranked by reactions)

### @itamarst — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19894#issuecomment-2512380033)

> I think I've figured out how to use row encoding, so now I just need to write lots and lots of tests and make sure it actually works beyond the trivial case I've already tested.

### @itamarst — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19894#issuecomment-2513162072)

> Unfortunately categorical and enum don't work (they also don't work for `search_sorted()`, which would be nice to fix); they _ought_ to work, since e.g. `pl.Series(["A", "B"], dtype=pl.Categorical) == "B"` works, but I'm not sure how that is different than what I'm doing, so would appreciate any hints.
> 
> E.g. for Categorical:
> 
> ```python
> >>> import polars as pl
> >>> pl.Series(["a", "b", "a"], dtype=pl.Categorical).index_of("a")
> Traceback (most recent call last):
>   File "<stdin>", line 1, in <module>
>   File "/home/itamarst/devel/polars/py-polars/polars/series/series.py", line 4771, in index_of
>     return F.select(F.lit(self).index_of(element)).item()
>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
>   File "/home/itamarst/devel/polars/py-polars/polars/functions/lazy.py", line 1913, in select
>     return pl.DataFrame().select(*exprs, **named_exprs)
>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
>   File "/home/itamarst/devel/polars/py-polars/polars/dataframe/frame.py", line 9113, in select
>     return self.lazy().select(*exprs, **named_exprs).collect(_eager=True)
>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
>   File "/home/itamarst/devel/polars/py-polars/polars/lazyframe/frame.py", line 2029, in collect
>     return wrap_df(ldf.collect(callback))
>                    ^^^^^^^^^^^^^^^^^^^^^
> polars.exceptions.InvalidOperationError: got invalid or ambiguous dtypes: '[cat, str]' in expression 'index_of'
> 
> Consider explicitly casting your input types to resolve potential ambiguity.
> 
> Resolved plan until failure:
> 
>         ---> FAILED HERE RESOLVING 'select' < … *[truncated]*

### @coastalwhite — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19894#issuecomment-2516443773)

> My guess is that you are treating a categorical as a string when it goes into the row encoding. If you want to compare the row encoding of a series with the row encoding of another series they need to have been encoded with the exact same dtype (i.e. so the same RevMap as well) otherwise the output is undefined. If search_sorted doesn't do that either, that is a bug and I can look into it.

### @itamarst — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19894#issuecomment-2517316537)

> @coastalwhite `search_sorted()` does gets it wrong, yes. And separately if memory serves, you pass in a non-matching `pl.lit("a", dtype=pl.Categorical)` it doesn't error out with mismatching categoricals, it gives the wrong result.

### @itamarst — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19894#issuecomment-2517319274)

> @coastalwhite and the question is _how_/_where_ do I convert to an enum/categorical, my attempts have failed so far.

### @itamarst — 0 reactions  
`—`  ·  [link](https://github.com/pola-rs/polars/pull/19894#issuecomment-2523452786)

> Ready for review again. Not sure what's up with the failing benchmark, doesn't seem related to this PR?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
