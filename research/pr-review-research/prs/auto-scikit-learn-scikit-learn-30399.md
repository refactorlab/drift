# scikit-learn/scikit-learn #30399 — ENH add `from_cv_results` in `RocCurveDisplay` (single `RocCurveDisplay`)

**[View PR on GitHub](https://github.com/scikit-learn/scikit-learn/pull/30399)**

| | |
|---|---|
| **Author** | @lucyleeow |
| **Status** | ✅ merged |
| **Opened** | 2024-12-03 |
| **Repo** | curated review-culture seed |
| **Diff** | +1574 / −134 across 6 files |
| **Engagement** | 24 conversation · 153 inline review comments |

## Top review comments (ranked by reactions)

### @jeremiedbb — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/30399#issuecomment-2536398813)

> As discussed in today's meeting, this is my favorite solution because it's the simplest and least surprising one from a user point of view, even though it adds a bit more internal complexity than the others. And I think we can mitigate some of it by extracting parts of the `plot` code into dedicated `_plot_single` and `_plot_multiple` methods. Or just into small helpers, that would already help readability.
> 
> It also looks like a good portion of the added complexity will be exactly the same for other displays like PRCurveDisplay, so there might be a chance that we'll be able to factorize some parts to be used by several displays.

### @DeaMariaLeon — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/30399#issuecomment-2602950502)

> As a (not so educated) user, I wonder if it wouldn't be better to add different colours to each plot line? (they all look blue now). I see that here it was decided to do that here: https://github.com/scikit-learn/scikit-learn/pull/30508#discussion_r1914297281.

### @jeremiedbb — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/30399#issuecomment-2607722107)

> I checked the choices that were made in terms of parameter naming in the code base when we accept a single value or a list of values and in most cases (not all thought) the singular name was kept. So I don't think that we need to make the parameter names plural and go through a deprecation cycle. I don't remember where this discussion was happening and might have missed something though.
> 
> (more comments regarding the rest of the PR soon :smile:)

### @lucyleeow — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/30399#issuecomment-2608793114)

> I'm happy to keep singular name, prevents deprecation!
> 
> You would allow both single ndarray and list of ndarray input right?

### @jeremiedbb — 1 reactions  
`👍 1`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/30399#issuecomment-2787732820)

> > Amended code to remove the "aggregate" parameters.
> 
> The diff still shows them though. Maybe you forgot to push your last commits ?
> 
> > line_kwargs now determines whether to label individual curves or single aggregate label - list means to label individual curves.
>     line_kwargs values that result in lines looking the same cannot be used with list name, as there is no point individualy labelling each curve, when all curves look the same
> 
> +1
> 
> > pass default line kwargs (from from_cv_results) through to plot as a single dict - this enables us to still be able to infer whether to aggregate label, without requiring an additional parameter
> not sure if https://github.com/scikit-learn/scikit-learn/pull/30399#discussion_r2026623754 works as the default line kwargs ({"alpha": 0.5, "linestyle": "--"}) don't seem to be passed?
> 
> I think we can define the default style directly in ``plot``, or even in the validate method and not have to pass it around. That's what I do in https://github.com/lucyleeow/scikit-learn/pull/2.
> 
> >  the code is at a stage where it is ready to be checked to see if you are happy with the overall implementation/API
> 
> Hard to tell since the diff doesn't yet all the API points that you discussed but I think I'm happy with what comes out of the different discussions, that is:
> 
> - By default, all curves have the same style: blue plain line. A single legend shows mean+std AUC.
> 
> - don't introduce "\*aggregate\*" parameters neither in ``from_cv_results`` nor in ``plot`` and instead automatically infer the style to adopt based on ``curve_kwargs`` and ``curve_name``.
> 
> - dep … *[truncated]*

### @lucyleeow — 0 reactions  
`—`  ·  [link](https://github.com/scikit-learn/scikit-learn/pull/30399#issuecomment-2566118287)

> The changes in [f0908e1](https://github.com/scikit-learn/scikit-learn/pull/30399/commits/f0908e1e7d14d5bf1c557b3b438c7302bed7ca9e) and [7e77d4c](https://github.com/scikit-learn/scikit-learn/pull/30399/commits/7e77d4c72307e6ea709624606ad84867af0a4652)  factorizes out common code (compared to #30508), adding helper function to either `_BinaryClassifierCurveDisplayMixin` (if function relevant to other binary displays) or `sklearn/utils/_plotting.py` (if function more generally applicable to more diplays - these potentially could be a parent class method?)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
