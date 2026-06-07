# scikit-learn/scikit-learn #32119 — FEA Add support for missing values in tree estimators with `criterion="absolute_error"` by greatly simplifying the logic

**[View PR on GitHub](https://github.com/scikit-learn/scikit-learn/pull/32119)**

| | |
|---|---|
| **Author** | @cakedev0 |
| **Status** | ✅ merged |
| **Opened** | 2025-09-06 |
| **Repo** | curated review-culture seed |
| **Diff** | +435 / −575 across 14 files |
| **Engagement** | 20 conversation · 200 inline review comments |

## Top review comments (ranked by reactions)

### @adam2392 — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32119#issuecomment-3675108038)

> I should have more time next week. Last push before the holidays at work. Feel free to continue pinging me.

### @cakedev0 — 2 reactions  
`👍 2`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32119#issuecomment-4000064699)

> Explanation of the last commit: While expanding the docstring of `next_p`, I noticed `missing_on_the_left` was not needed: it's a duplicate of the variable `missing_go_to_left` in the best split function. And the call site of `next_p` is precisely this best split function, so we can directly pass `missing_go_to_left` to `next_p` there.

### @adam2392 — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32119#issuecomment-3289701088)

> Let's keep this in draft mode until we merge #32100. Ping here for a review after the initial PRs are sorted out

### @cakedev0 — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32119#issuecomment-3765288780)

> I had introduced a regression in `node_split_random` with my changes:
> 
> The regression came from the change in `sklearn/tree/_partitioner.pyx` that seeds `min_feature_value`/`max_feature_value` with `X[samples[self.start], current_feature]` before the scan, this can be `NaN` and in this case it will remain `NaN` as conditions like `current_feature_value < min_feature_value` will return `False`.
> 
> `sklearn/tree/_splitter.pyx` then draws a random threshold from `NaN`  bounds, which breaks the random splitter.
> 
> The [fix](https://github.com/scikit-learn/scikit-learn/pull/32119/commits/fa4cae95bd1ebc2affecef2f44ca7e444fc3d675) restores the missing‑aware behavior by initializing min/max from the first non‑missing value.
> 
> I added a [non-regression test](https://github.com/scikit-learn/scikit-learn/pull/32119/commits/84872374091418b10ac225729dc1ce620bb96d7b), because this seems easy to re-introduce.
> 
> [bug found, and fixed by codex, test written by codex; but I reviewed everything]

### @adam2392 — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32119#issuecomment-3959759099)

> I think most of the review is now cosmetic, and overall the changes lgtm. lmk when you're done addressing some of the threads, and I can take a final look. 
> 
> @ogrisel do you want to take another look before I merge at that point?

### @cakedev0 — 0 reactions  
`—`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/32119#issuecomment-3274589844)

> Note: at this day, tests passes on my laptop and most CI unit tests pipelines are successful. But some are failing, I managed to reproduce one of the failing pipelines locally using a Docker image. I still need to find the bug though.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
