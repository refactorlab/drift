# scikit-learn/scikit-learn #31937 — ENH: Display the number and names of output features

**[View PR on GitHub](https://github.com/scikit-learn/scikit-learn/pull/31937)**

| | |
|---|---|
| **Author** | @DeaMariaLeon |
| **Status** | ✅ merged |
| **Opened** | 2025-08-13 |
| **Repo** | curated review-culture seed |
| **Diff** | +551 / −35 across 13 files |
| **Engagement** | 76 conversation · 135 inline review comments |

## Top review comments (ranked by reactions)

### @glemaitre — 2 reactions  
`👍 2`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/31937#issuecomment-3338840797)

> The current copy-paste of the following block:
> 
> <img width="198" height="102" alt="image" src="https://github.com/user-attachments/assets/73101dcd-eb61-4043-821e-90b7305ae57a" />
> 
> would provide the following output:
> 
> ```
> sepal length (cm)
> sepal width (cm)
> petal length (cm)
> petal width (cm)
> ```
> 
> I would to think that I would like a Python list representation actually:
> 
> ```python
> [
>     "sepal length (cm)",
>     "sepal width (cm)",
>     "petal length (cm)",
>     "petal width (cm)"
> ]
> ```
> 
> because I can use it in the notebook directly. However, I would prefer to have thoughts from @ogrisel and @jeremiedbb because maybe that this copy-paste button is not useful at the end.

### @glemaitre — 2 reactions  
`👍 1 · 😄 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/31937#issuecomment-3711373166)

> I'm completely OK with the consolidated list of feature. Actually, during my last review I kind of thought about it and I was wondering if we should have. Now that it is implemented, I'm sure that I want it :)

### @ogrisel — 2 reactions  
`👍 2`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/31937#issuecomment-3908561441)

> > I played a bit with the plot_cyclical_feature_engineering notebook and noticed some unexpected behaviors. For instance, the full pipeline (cyclic_spline_interactions_pipeline) at the end looks like this
> 
> > The interactions ColumnTransformer on the right looks fine but the marginal ColumnTransformer on the left is not displayed as a ColumnTransformer. This maybe a bug unrelated to this PR
> 
> I agree this is a bug unrelated to this PR: I can reproduce it by displaying `cyclic_spline_interactions_pipeline` in a new cell on `main`. 
> 
> > but as a consequence, I believe, the total number of output features from marginal is not shown. (Note that when displayed on its own it's rendered as expected).
> 
> I think we should still fix it independently. @DeaMariaLeon could you please open a dedicated issue to investigate this bug irrespective of the feature output names?

### @jeremiedbb — 2 reactions  
`👀 1 · 😄 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/31937#issuecomment-4253902061)

> > oh.. but I'm doing it with the trackpad, not the mouse! it works that way with firefox too (not the mouse but the trackpad inside the laptop).
> 
> hum, but it's not a laptop for me, there's no trackpad 😄

### @glemaitre — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/31937#issuecomment-3219433865)

> > Should I add the feature names on this PR?
> 
> I want to dissociate it at first but since we are going to create a new block, it might be better to have directly the feature names as well.

### @glemaitre — 1 reactions  
`👀 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/31937#issuecomment-3327332278)

> It terms the information to have, it looks good. I think that I would like to have a copy button in the box. In terms of rendering, I think that we need:
> 
> - to have smaller padding on top and bottom to make this box tiny
> - to have the border of the box rounded
> - to have the width of the internal table at `95%`
> - to have enough internal padding such that the content is readable
> - the background of the section when toggled should be lighter (the lightest blue) for all items
> 
> I think it is a start list but we can have another pass.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
