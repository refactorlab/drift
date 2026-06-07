# pandas-dev/pandas #61828 — BUG: Dataframe arithmatic operators don't work with Series using fill_value

**[View PR on GitHub](https://github.com/pandas-dev/pandas/pull/61828)**

| | |
|---|---|
| **Author** | @eicchen |
| **Status** | ✅ merged |
| **Opened** | 2025-07-10 |
| **Repo importance** | ★48,910 · 19,993 forks · score 133,847 |
| **Diff** | +119 / −56 across 7 files |
| **Engagement** | 31 conversation · 111 inline review comments |

## Top review comments (ranked by reactions)

### @jbrockmendel — 1 reactions  
`👍 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/61828#issuecomment-3330818766)

> Just take the diff from #62317, then go to the 1 test that was xfailed and started not-failing in some situations and update the xfail to exclude those situations.

### @jbrockmendel — 1 reactions  
`👍 1`  ·  [link](https://github.com/pandas-dev/pandas/pull/61828#issuecomment-4014148485)

> > im hoping we get rid of the dont-infer-string build soon and IIRC this should be ready then
> 
> I asked the others about this and it seems like we're keeping that build around for a little while.  im not totally clear on why, but se la vie.
> 
> Looks like you've got an `xpass` situation.

### @eicchen — 0 reactions  
`—`  ·  [link](https://github.com/pandas-dev/pandas/pull/61828#issuecomment-3075024201)

> Im closing the PR for now until the additional fixes for EA are deployed

### @eicchen — 0 reactions  
`—`  ·  [link](https://github.com/pandas-dev/pandas/pull/61828#issuecomment-3202352346)

> Reopened to talk about fixes for this specific issue before I get sidetracked by 1D operations again (ignore all the failed checks for now)

### @jbrockmendel — 0 reactions  
`—`  ·  [link](https://github.com/pandas-dev/pandas/pull/61828#issuecomment-3207281872)

> The appropriate fix is going to be in _maybe_align_series_as_frame

### @eicchen — 0 reactions  
`—`  ·  [link](https://github.com/pandas-dev/pandas/pull/61828#issuecomment-3208112132)

> > The appropriate fix is going to be in _maybe_align_series_as_frame
> 
> So this was what I was working on locally, and had questions about. I was able to reshape EAs in _maybe_align_series_as_frame and am still working on various places to get the operation smoothed out. But I feel like this issue deviates from the original issue, which is only related to fill_value. As far as I can tell this is not related to that issue so we should probably file it under another and mark the original closed for bookkeeping. 
> 
> I can add another test case which wouldn't require 2D EA operations for the dtype test. 
> 
> (There was original a bunch of brain spew about issues I was currently having, but I'll organize it before reposting if needed)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
