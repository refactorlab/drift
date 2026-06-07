# gohugoio/hugo #13541 — Reimplement and simplify Hugo's template system

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/13541)**

| | |
|---|---|
| **Author** | @bep |
| **Status** | ✅ merged |
| **Opened** | 2025-03-30 |
| **Repo importance** | ★88,408 · 8,267 forks · score 126,465 |
| **Diff** | +5339 / −4393 across 138 files |
| **Engagement** | 25 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @jmooring — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/gohugoio/hugo/pull/13541#issuecomment-2781488646)

> I can't break this.
> 
> I've tried some stupid, convoluted, unrealistic setups and they all work. And that includes the often-forgotten [content view](https://gohugo.io/templates/content-view/) templates.
> 
> > see if you agree with my choices in the "lookup department"; the most opinionated is probably the path/depth logic. 
> 
> Maybe this was lazy on my part, but I didn't spend any time digging into the lookup mechanics because the behavior is intuitive. Perhaps some of your choices were opinionated, but none of them were surprising.
> 
> > I have tried to explain it above, I'm not sure how well I succeeded.
> 
> Given how intuitive this is, I am inclined to keep the documentation simple, perhaps using examples more than textual descriptions. Your detailed explanation belongs somewhere, but not front-and-center. To be honest, I didn't spend any time reading your explanation while testing this... everything just worked.
> 
> Ship it.

### @bep — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/gohugoio/hugo/pull/13541#issuecomment-2796244522)

> @jakebailey I don't follow closed PRs (or: almost never). If you think it's a bug, create a new issue, for questions, see https://discourse.gohugo.io/ 
> 
> We have tested many Hugo sites in the wild without any issues and need for any upgrade and the entire Hugo test suite was green without adjustments, but this replaces 10 years of accumulated and confusing logic, so some breakage were expected.

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/13541#issuecomment-2775112638)

> @jmooring none of those issues is somehow fixed by this (whatever that would mean). But the order of things is certainly easier to reason about in the new setup:
> 
> ```go
> if err := s.insertTemplates(nil, false); err != nil {
>   return nil, err
> }
> if err := s.insertEmbedded(); err != nil {
>   return nil, err
> }
> if err := s.parseTemplates(); err != nil {
>   return nil, err
> }
> if err := s.extractInlinePartials(); err != nil {
>   return nil, err
> }
> if err := s.transformTemplates(); err != nil {
>   return nil, err
> }
> if err := s.tns.createPrototypes(true); err != nil {
>   return nil, err
> }
> if err := s.prepareTemplates(); err != nil {
>   return nil, err
> }
> ```
> 
> So, while we `extractInlinePartials` later, we don't overwrite partials with the same path[^1]. If we did, that would for one break how we use the file system overlay to override templates (project partial wins over theme partial). That could possibly be handled, but that is certainly not in scope here.
> 
> [^1]: ... but if you should be able to override by using e.g. `mypartial.html.html` (e.g. both output format and media type)

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/13541#issuecomment-2775951989)

> @jmooring All tests are green and I have completed my TODO list. I will do some more manual testing of this myself, but I would appreciate if you could take it for a spin, and especially see if you agree with my choices in the "lookup department"; the most opinionated is probably the path/depth logic. I have tried to explain it above, I'm not sure how well I succeeded.

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/13541#issuecomment-2776018690)

> @jmooring good catch, odd that none of my tests caught this. Probably a confusion between text and html parsing for the partial func. If you do this, it "works":
> 
> ```handlebars
> {{ partialCached "head/css.html" . | safeHTML }}
> ```
> 
> Which is obviously not what we want. I will add a test for this and fix it.

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/13541#issuecomment-2777905296)

> @jmooring I have pushed a fix for the output format issue in fd073d256e745d2f214ec55c9f6b2086d499cd79 -- I have also created a "task list" in the intro comment to indicate status of any similar future issue.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
