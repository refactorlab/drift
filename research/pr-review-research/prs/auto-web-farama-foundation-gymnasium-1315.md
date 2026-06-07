# Farama-Foundation/Gymnasium #1315 — Add stochastic taxi (rainy+fickle)

**[View PR on GitHub](https://github.com/Farama-Foundation/Gymnasium/pull/1315)**

| | |
|---|---|
| **Author** | @foreverska |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pseudo-rnd-thoughts
> Could you change the `np.random` to `self.np_random` and revert the environment version increment (new features that don't affect default behaviour shouldn't require version bumps)

### @pseudo-rnd-thoughts
> Is this backward compatible with default parameters? If it does currently, could we make it backward compatible.

### @pseudo-rnd-thoughts
> Looking over the PR again, I'm a tad worried about the `is_rainy` change. Is there a way of making the code only run if `is_rainy` is true?

### @pseudo-rnd-thoughts
> I would prefer if the new code was 'disabled' by default and wouldn't run at some, unlike the current solution. I know that this produces arguably less elegant code, I think it will be better maintenance and for people understanding the code.

### @pseudo-rnd-thoughts
> To minimise changes, could this function, take `row, col, pass_idx, dest_idx, action` as arguments that we run the original code unless `is_rainy` then we call this function.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
