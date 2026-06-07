# scikit-learn/scikit-learn #31937 — ENH: Display the number and names of output features

**[View PR on GitHub](https://github.com/scikit-learn/scikit-learn/pull/31937)**

| | |
|---|---|
| **Author** | @DeaMariaLeon |
| **Status** | Merged (Apr 15, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @glemaitre
> We have an internal PassThrough transformer that forward the input feature as-is and this it means that we should mention that the output feature are the same as `n_features_in_`.

### @jeremiedbb
> I find the block a bit big, it takes as much space as the estimator itself...I would like something smaller...the proposal to make the 'feature' being blocks leaving on their own is nice.

### @glemaitre
> I want to dissociate it at first but since we are going to create a new block, it might be better to have directly the feature names as well.

### @AnneBeyer
> Maybe you can find it faster? It seems to be related to `names=estimator.__class__.__name__,` in `_get_visual_block` when `estimator` is `(None,)`

### @jeremiedbb
> when the html repr is too large, there's no horizontal scrollbar...It doesn't seem to be a bug introduced in this PR but it makes the rendering of the modified examples not great.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
