# chartjs/Chart.js #12070 — Fix: display stacked bar with multiple x-Axis

**[View PR on GitHub](https://github.com/chartjs/Chart.js/pull/12070)**

| | |
|---|---|
| **Author** | @xavierleune |
| **Status** | ✅ merged |
| **Opened** | 2025-05-07 |
| **Repo importance** | ★67,478 · 11,947 forks · score 120,146 |
| **Diff** | +92 / −4 across 3 files |
| **Engagement** | 15 conversation · 2 inline review comments |

## Top review comments (ranked by reactions)

### @liondog — 3 reactions  
`👍 2 · 👀 1`  ·  [link](https://github.com/chartjs/Chart.js/pull/12070#issuecomment-2990481902)

> @LeeLenaleee, @etimberg This change broke my code. I'm using two x-axes to create an annotation effect with a bar chart:
> <img width="369" alt="Github Chartjs Issue" src="https://github.com/user-attachments/assets/09f08ca8-122a-4be9-be43-e689861d1f57" />
> 
> The annotation is the red bullet. A real world scenario would be to indicate that a bar is beyond a limit. I'm doing this by having a secondary x-axis on top of the chart area. To create an (optional) annotation I'm styling the tick label using a red bullet "⬤". This approach solved many other issues, e.g. you can easily hide the annotations by hiding just the secondary x-axis and it also frees space on the canvas when it's hidden by just the way Chart.js works. 
> 
> With this change my bars appear misaligned to the left. The reason is obvious as now two x-axes are counted and that alters the calculation of the bar positions in a bad in IMO unexpected way. I understand the intention of this PR but I'm also conviced the new behavior is a bug. Instead of grouping bars using multiple x-axes one should group using a group of bars instead: https://www.chartjs.org/docs/latest/samples/bar/stacked-groups.html.
> 
> I can imagine this change will break other applications, too. For me, I either create another local patch to restore the previous behavior as now I cannot see any other way to implement this aside from creating a (complex) plugin.
> 
> Edit: Or maybe we need a flag to indicate whether an axis should be counted. Creating this flag should be easy. But the question remains whether this is the right approach anyways or if one should ju … *[truncated]*

### @chatondearu — 2 reactions  
`👍 2`  ·  [link](https://github.com/chartjs/Chart.js/pull/12070#issuecomment-3083727553)

> hi there :)
> 
> I am experiencing an issue related to this bug fix. I utilized stacked bar charts across different axes to overlay a background chart aligned with a time-based axis for visualizing weekend days. When rendering my bar charts with the `grouped = false` option, the visualization behaves as expected for all stacked bars but when their not stacked all bars are centered on their respective grid lines. However, when setting `grouped = true`, all axis are aligned on the same grid. This behavior appears to be linked to the `grouped` configuration for bar charts.
> 
> Would it be possible to implement a `dataset.group = 'name'` property analogous to the `dataset.stack` option? The intent is to prevent the irregular alignment observed when manipulating both the `grouped` and `stacked` options across multiple axes.

### @xavierleune — 1 reactions  
`👍 1`  ·  [link](https://github.com/chartjs/Chart.js/pull/12070#issuecomment-2944376641)

> thanks for the feedback @etimberg I'll have a look on that test 👍

### @xavierleune — 1 reactions  
`👍 1`  ·  [link](https://github.com/chartjs/Chart.js/pull/12070#issuecomment-2944513239)

> Ok I see, this test use: `indexAxis: 'y'` and this pull request focuses on `x` axis. I'll make the code more generic

### @xavierleune — 1 reactions  
`👍 1`  ·  [link](https://github.com/chartjs/Chart.js/pull/12070#issuecomment-2944867703)

> This should be correct now, I carefuly reviewed the tests and I think the other failures are only due to fonts mismatch and so... 🤞

### @liondog — 1 reactions  
`👍 1`  ·  [link](https://github.com/chartjs/Chart.js/pull/12070#issuecomment-3006376067)

> > @liondog the stacked group has a different purpose, having different x-axis allows to display side by side different temporal data (i.e: comparison between 2024 and 2025, month by month) ; with stacked groups you won't have different labels (that why multiple axis are made for). It seems to me that this bugfix is still justified and you used a bug as a feature ^^ Fixing a bug is always a kind of BC Break and I don't think that reverting this bugfix to use axis as annotations a good idea.
> 
> Thank you for giving more insights into your rationale for using two stacked timescales :-). It's a nice way of some sort of "line wrap" on one axis.
> 
> I wouldn't say that the previous behavior was a bug. That was, after all, the unchanged behavior of Chart.js for many years. I think both approaches are correct in their way. Perhaps your behavior could be extended to only count axes on the same border? Or on the same configurable "stack" (meaning a type of configuration that logically groups scales together, as implemented by this bug fix). Otherwise, what is the point of a second x-axis aligned to the _top_? Imagine another example with months being plotted on the bottom x-axis and quarters on another x-axis at the top of the chart to get a different visual grouping for the same bar dataset. This won't work anymore.
> 
> I will need more time to work out another possible solution for my use case, but for now I am fine with my patch. Your suggestions are not easily implementable as they introduce other problems.
> 
> To summarize: In my humble opinion, these two different approaches should be con … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
