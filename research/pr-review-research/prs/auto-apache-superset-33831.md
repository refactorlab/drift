# apache/superset #33831 — feat(dashboard): chart customization/dynamic group by in dashboards

**[View PR on GitHub](https://github.com/apache/superset/pull/33831)**

| | |
|---|---|
| **Author** | @LevisNgigi |
| **Status** | ✅ merged |
| **Opened** | 2025-06-19 |
| **Repo importance** | ★73,183 · 17,524 forks · score 148,279 |
| **Diff** | +6704 / −263 across 57 files |
| **Engagement** | 56 conversation · 70 inline review comments |

## Top review comments (ranked by reactions)

### @mistercrunch — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/33831#issuecomment-3033733323)

> Curious whether we have designs upfront for this or whether we can get screenshots. Seems dashboard "Filters" might need to become "Interactivity" or "Filters & Interactive Controls" or something broader than just filters. Curious on how we restructure the Filter-focussed elements ...
> 
> Also thinking forward about integrating a similar "Metric-picker" interactive component that broadcast metric selection to multiple charts. Let's make sure the abstractions here will nicely support the metric picker and other future dashboard interactivity controls.

### @geido — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/33831#issuecomment-3045104958)

> > Curious whether we have designs upfront for this or whether we can get screenshots. Seems dashboard "Filters" might need to become "Interactivity" or "Filters & Interactive Controls" or something broader than just filters. Curious on how we restructure the Filter-focussed elements ...
> > 
> > Also thinking forward about integrating a similar "Metric-picker" interactive component that broadcast metric selection to multiple charts. Let's make sure the abstractions here will nicely support the metric picker and other future dashboard interactivity controls.
> 
> cc @kasiazjc

### @LevisNgigi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/33831#issuecomment-3045140311)

> > Curious whether we have designs upfront for this or whether we can get screenshots. Seems dashboard "Filters" might need to become "Interactivity" or "Filters & Interactive Controls" or something broader than just filters. Curious on how we restructure the Filter-focussed elements ...
> > 
> > Also thinking forward about integrating a similar "Metric-picker" interactive component that broadcast metric selection to multiple charts. Let's make sure the abstractions here will nicely support the metric picker and other future dashboard interactivity controls.
> 
> yes we do have designs for this, will also be adding screenshots/video to the pr description.Designs are as as below:
> ![gorup_by2](https://github.com/user-attachments/assets/8aa77ba3-5e4e-49eb-a9b3-de76d3c0e393)
> ![group_by](https://github.com/user-attachments/assets/d6e54137-9d6c-4c3e-8f22-3bd41a2b8463)

### @mistercrunch — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/33831#issuecomment-3046220217)

> Oh I see the modal title is "Chart customization in dashboard". Not sure if it's the best name. @kasiazjc @yousoph what do you think of "Dashboard interactivity controls" (?) or "Dashboard Filters and interactive controls". 
> 
> We need new naming / titles that include things beyond filters, but I'm guessing that 99%+ of the time it'll be used for dashboard filters so it may be good to keep "filter" in the naming.

### @amaannawab923 — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/33831#issuecomment-3132925810)

> > From testing: setting a groupby to clinical_stage gives the error:
> > 
> > ```
> > Data error
> > Duplicate column/metric labels: "clinical_stage". Please make sure all columns and metrics have a unique label.
> > ```
> > 
> > For some charts.
> 
> This is because the groupby is same as the x axis applied ... While applying the groupby we need to exclude the charts who have the same value in their x axis

### @LevisNgigi — 0 reactions  
`—`  ·  [link](https://github.com/apache/superset/pull/33831#issuecomment-3134146830)

> > From testing: setting a groupby to clinical_stage gives the error:
> > 
> > ```
> > Data error
> > Duplicate column/metric labels: "clinical_stage". Please make sure all columns and metrics have a unique label.
> > ```
> > 
> > For some charts.
> 
> ohh yes it needs to skip for charts with similar columns in their x-axis,added this fix.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
