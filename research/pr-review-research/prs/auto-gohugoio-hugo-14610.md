# gohugoio/hugo #14610 — Add css.Build (using ESBuild to transform CSS resources)

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/14610)**

| | |
|---|---|
| **Author** | @bep |
| **Status** | ✅ merged |
| **Opened** | 2026-03-09 |
| **Repo importance** | ★88,408 · 8,267 forks · score 126,465 |
| **Diff** | +598 / −70 across 16 files |
| **Engagement** | 23 conversation · 14 inline review comments |

## Top review comments (ranked by reactions)

### @jmooring — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14610#issuecomment-4028802744)

> I wanted to create a simple "loaders" example for the docs:
> 
> Without any loaders, with this CSS:
> 
> ```css
> body {
>   background: url('../images/circle.png') no-repeat center center fixed;
> }
> ```
> 
> I get this:
> 
> > CSSBUILD: failed to transform "/css/main.css" (text/css): "/home/jmooring/code/hugo-testing/assets/images/circle.png:1:0": Unexpected "\x89"
> 
> I think `\x89` is the first part of the file signature.
> 
> As a guess, I defined a loader for `.png` files:
> 
> ```text
> {{ $opts := dict "loaders" (dict ".png" "dataurl") }}
> ```
> 
> That works great. But for a larger file I may not want to embed the data. So I tried this:
> 
> ```text
> {{ $opts := dict "loaders" (dict ".png" "file") }}
> ```
> 
> But then the published CSS file (`public/css/main.css`) is the PNG file with a `.css` extension.
> 
> Admittedly I have zero experience with this, so there may be a better way to handle it, but I'm wondering if we want a default map of loaders for common file formats. This assumes that we could somehow make the `file` loader do what we want. It would be great if users didn't run into errors like `Unexpected "\x89"`.

### @jmooring — 1 reactions  
`🎉 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14610#issuecomment-4034169002)

> I'm out for the rest of the day. I'll test more this evening and try to finish the docs by tomorrow mid-day. This is slick.

### @jmooring — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14610#issuecomment-4044680813)

> If we exclude "main" you won't be able to import packages like the-new-css-reset.

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14610#issuecomment-4044841501)

> ... I suggest we add a `mainFields` option (default nil).

### @jmooring — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/14610#issuecomment-4028341751)

> Request:
> 
> According to the esbuild docs, `sourceMap` is one of `linked`, `external`, `inline`, or `both`. Can you please add `none` to the list of allowable values? In our docs it's easier to say "Default is `none`" instead of something like "Default is an empty string, which means don't create a source map."
> 
> Question:
> 
> For the `engines` slice/list, is the default behavior (an empty slice) to skip transformations? Also, I'd be inclined to call the option "target" to match the esbuild docs. Every option in our documentation will have a "see details" link to the corresponding section in the esbuild docs; it would be nice if our option name matched theirs. Whether we use singular or plural forms is irrelevant. 
> 
> EDIT: It would be great to be able to use browserslist instead of having to update targets over time.

### @bep — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/14610#issuecomment-4029562140)

> >Also, I'd be inclined to call the option "target".
> 
> I'm not totally sure. It makes the option parsing/documentation fuzzy. These are 2 very distinct things in the ESBuild Go API and target (one value, e.g. ES2020) is a JavaScript only option. `engines` is used for both (I think). 
> 
> EDIT in: Yes, I will rename it to `target`, and make it into a string or a slice. 
> 
> > It would be great if users didn't run into errors like Unexpected "\x89".
> 
> I agree, I will do more testing on this today.
> 
> Thanks for your detailed feedback.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
