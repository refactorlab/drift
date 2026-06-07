# bigskysoftware/htmx #3234 — Replace jsDelivr w/ UNPKG

**[View PR on GitHub](https://github.com/bigskysoftware/htmx/pull/3234)**

| | |
|---|---|
| **Author** | @SukkaW |
| **Status** | ✅ merged |
| **Opened** | 2025-03-15 |
| **Repo importance** | ★48,161 · 1,599 forks · score 59,533 |
| **Diff** | +47 / −47 across 16 files |
| **Engagement** | 16 conversation · 3 inline review comments |

## Top review comments (ranked by reactions)

### @SukkaW — 1 reactions  
`👍 1`  ·  [link](https://github.com/bigskysoftware/htmx/pull/3234#issuecomment-2831879447)

> > Just a thought...PR review might take a while. Within that time you may be able to just switch over to shortcodes for all the htmx script tags in the website code samples. Might make it a more compelling PR overall.
> 
> Sure, lemme see if I can do this.

### @SukkaW — 1 reactions  
`👍 1`  ·  [link](https://github.com/bigskysoftware/htmx/pull/3234#issuecomment-3083754237)

> > Now that PR #3358 has been merged, I'll have a go at getting rid of the duplication, if that's OK.
> 
> Please go ahead! I am currently on vacation, so I might not be able to work on this.

### @SukkaW — 0 reactions  
`—`  ·  [link](https://github.com/bigskysoftware/htmx/pull/3234#issuecomment-2766670491)

> UNPKG was down again from `Mar 31, 2025, 7:00 AM UTC` and lasted 8 hours (https://github.com/unpkg/unpkg/issues/443), I urge everyone to immediately migrate away from unpkg to jsDelivr now.

### @SukkaW — 0 reactions  
`—`  ·  [link](https://github.com/bigskysoftware/htmx/pull/3234#issuecomment-2817292181)

> > LGTM. As a future improvement, I wonder if Zola has a way to factor out common blocks of Markdown and then include them. Could save a lot of duplication.
> > 
> > EDIT: duplication can be factored out with shortcodes, eg:
> > 
> > ```
> > 
> > 
> > <script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.4/dist/htmx.min.js"></script>
> > ```
> > 
> > Usage:
> > 
> > ```
> > 
> > 
> > ## quick start
> > 
> > ...
> > {{ htmx_min_js() }}
> > ```
> 
> It looks like it belongs to a future PR, though. If you like, I can work on this once the PR is merged.

### @yawaramin — 0 reactions  
`—`  ·  [link](https://github.com/bigskysoftware/htmx/pull/3234#issuecomment-2831789383)

> Just a thought...PR review might take a while. Within that time you may be able to just switch over to shortcodes for all the htmx script tags in the website code samples. Might make it a more compelling PR overall.

### @1cg — 0 reactions  
`—`  ·  [link](https://github.com/bigskysoftware/htmx/pull/3234#issuecomment-2931609744)

> Can you target this to `dev` and I'll merge?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
