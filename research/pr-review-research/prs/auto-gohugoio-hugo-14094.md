# gohugoio/hugo #14094 — markup/asciidocext: Improve Asciidoctor integration

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/14094)**

| | |
|---|---|
| **Author** | @jmooring |
| **Status** | ✅ merged |
| **Opened** | 2025-10-24 |
| **Repo importance** | ★88,408 · 8,267 forks · score 126,465 |
| **Diff** | +1947 / −671 across 17 files |
| **Engagement** | 21 conversation · 11 inline review comments |

## Top review comments (ranked by reactions)

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14094#issuecomment-3533902904)

> @jmooring the "concurrent map writes" is my mistake. I will fix that tomorrow, see #14140.

### @bep — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14094#issuecomment-3536466085)

> I think the practical way forward to get this merged (as it solves a real issue) is to pull up "some" of the most important test cases to the top and do a 
> 
> ```go
> const slowThreshold = 5
> if i > slowThreshold && os.GetEnv("SOME_VARIABLE" )) == "" {
>    break
> }
> ```
> 
> ... or something.
> 
> And then revisit this later when the cache issue is resolved.

### @jmooring — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14094#issuecomment-3538988044)

> @bep Let's hold off on this for a day or two. There's a new [upstream release](https://github.com/asciidoctor/asciidoctor-diagram/releases/tag/v3.1.0) that implements caching and GoAT diagrams.

### @jmooring — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14094#issuecomment-3553167805)

> @bep I could use another set of eyes on this. I cannot figure out why the CI runs continue to fail. The new integration test passes:
> 
> ```text
> ok  	github.com/gohugoio/hugo/markup/asciidocext	53.224s
> ```
> 
> But the job dies later in the process.

### @jmooring — 1 reactions  
`😕 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14094#issuecomment-3560159134)

> It's looks like there are still some space issues or something on Linux.

### @jmooring — 1 reactions  
`👍 1`  ·  [link](https://github.com/gohugoio/hugo/pull/14094#issuecomment-3563699373)

> This is ready for final review.
> 
> Integration test details:
> 
> - Generates GoAT diagrams instead of Ditaa diagrams
> - Enables the caching mechanism introduced in v3.0.1 of the asciidoctor-diagram extension
> - Runs only when IsRealCI is true
> - Runs all subtests on Linux
> - Runs 3 of the subtests on Windows
> 
> When testing locally on Linux with Ditaa diagrams, the benefits of diagram caching are obvious. When using GoAT diagrams, the benefit is less noticeable because generation is very fast. On Windows, the benefits of diagram caching for simple diagrams are negligible due to the overall slower performance of the Asciidoctor calls.
> 
> Current CI test duration:
> 
> - Linux: ~50s (runs all 20 subtests)
> - Windows: ~30s (runs 3 of 20 subtests)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
