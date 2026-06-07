# gohugoio/hugo #11866 — markup/goldmark: Support passthrough extension

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/11866)**

| | |
|---|---|
| **Author** | @j2kun |
| **Status** | ✅ merged |
| **Opened** | 2024-01-06 |
| **Repo importance** | ★88,408 · 8,267 forks · score 126,465 |
| **Diff** | +161 / −0 across 5 files |
| **Engagement** | 18 conversation · 6 inline review comments |

## Top review comments (ranked by reactions)

### @CLAassistant — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/11866#issuecomment-1879761374)

> [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/gohugoio/hugo?pullRequest=11866) <br/>All committers have signed the CLA.

### @j2kun — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/11866#issuecomment-1902529032)

> Trying the initial integration with my blog, I'm seeing some issues with the renderer. When I configure my personal block via https://github.com/j2kun/math-intersect-programming/commit/892f42db29a388ae18e7aab70f6b3d4a579b66a4:
> 
> ```
> [markup.goldmark.extensions.passthrough]
>   enable = true
>   blockDelimiters = [
>     {open = "$$", close = "$$"},
>     {open = "\\[", close = "\\]"},
>   ]
>   inlineDelimiters = [
>     {open = "$", close = "$"},
>     {open = "\\(", close = "$\\)"},
>   ]
> ```
> 
> I see
> 
> ```
> ERROR render of "page" failed: "/home/j2kun/blog/themes/paperesque/layouts/_default/baseof.html:9:7": execute of template failed: template: _default/single.html:9:7: executing "_default/single.html" at <partial "meta.html" .>: error calling partial: execute of template failed: template: _internal/opengraph.html:2:98: executing "_internal/opengraph.html" at <.Summary>: error calling Summary: runtime error: invalid memory address or nil pointer dereference
> Total in 206 ms
> Error: error building site: render: failed to render pages: render of "page" failed: "/home/j2kun/blog/themes/paperesque/layouts/_default/baseof.html:9:7": execute of template failed: template: _default/single.html:9:7: executing "_default/single.html" at <partial "meta.html" .>: error calling partial: execute of template failed: template: _internal/opengraph.html:2:98: executing "_internal/opengraph.html" at <.Summary>: error calling Summary: runtime error: invalid memory address or nil pointer dereference
> ```
> 
> Based on the `opengraph.html`, this seems related to hugo, not the theme I'm using: https://github.com/gohugoio/hu … *[truncated]*

### @jmooring — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/11866#issuecomment-1902531901)

> I may have some time to look at this tomorrow, but the config structure is different that what we (I) discussed here:
> <https://github.com/gohugoio/hugo-goldmark-extensions/pull/2#issuecomment-1899076657>
> 
> Of the two options, I like the second one better.
> 
> Whether a delim is an opener or a closer should be inferred from its position in the array. There's an [example of this](https://gohugo.io/getting-started/configuration/#configure-minify) in the config structure for [tdewolff/minify](https://github.com/tdewolff/minify), e.g., 
> 
> ```text
> [minify.tdewolff.html]
>     templateDelims = ['<?php', '?>']
> ```
> 
> I took what you have done so far for quick test drive with the test cases repo/branch:
> 
> ```text
> git clone --single-branch -b hugo-github-issue-10894 https://github.com/jmooring/hugo-testing hugo-github-issue-10894
> cd hugo-github-issue-10894
> hugo server
> ```
> 
> Works great!

### @jmooring — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/11866#issuecomment-1902695888)

> I haven't tried to reproduce the error you encountered, but I noticed that your config is probably not what you intended:
> 
> ```text
> inlineDelimiters = [
>   {open = "$", close = "$"},
>   {open = "\\(", close = "$\\)"},  # should be {open = "\\(", close = "\\)"}
> ]
> ```

### @jmooring — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/11866#issuecomment-1902710536)

> On the Hugo side of this (not the extension), the default config should include the four pairs of delimiters [described here](https://github.com/gohugoio/hugo-goldmark-extensions/pull/2#issuecomment-1899076657), with the ability to override to replace, remove, or add pairs of delimiters.
> 
> For example, if my markdown includes LaTeX mathematical expressions/equations, this should be all I need to do[^1]:
> 
> ```yaml
> markup:
>   goldmark:
>     extensions:
>       passthrough:
>         enable: true
> ```
> 
> If I want to avoid fighting with dollar signs in markdown (e.g., "the price is $2.00"), I should be able to do this:
> 
> ```yaml
> markup:
>   goldmark:
>     extensions:
>       passthrough:
>         enable: true
>         delimiters:
>           inline:
>             - ['\(','\)'] 
>           block:
>             - ['\[','\]']
> ```
> 
> [^1]: Assumes you are loading KaTeX or MathJax.

### @jmooring — 0 reactions  
`—`  ·  [link](https://github.com/gohugoio/hugo/pull/11866#issuecomment-1902738400)

> @j2kun Here is one of several posts that is triggering the error:
> 
> ```text
> content/posts/2017-08-14-notes-on-math-and-gerrymandering.md
> ```
> 
> Specifically, this is the bit that is causing the problem:
> 
> ```text
> \[Soapbox\] ... \[/Soapbox\]
> ```
> 
> Which can be reduced to:
> 
> ```text
> \[x\] \[x\]
> ```
> 
> The error is not specific to your site or theme. It can be reproduced in a test case with:
> 
> ```text
> ---
> title: foo
> ---
> 
> \[x\] \[x\]
> ```
> 
> or
> 
> ```text
> ---
> title: foo
> ---
> 
> $$x$$ $$x$$
> ```
> 
> So, any time you have two or more passthrough blocks in the same markdown paragraph.
> 
> This test panics in passthrough/passthrough_test.go:
> 
> ```go
> func TestExample27(t *testing.T) {
> 	input := `$$x$$ $$x$$`
> 	fmt.Println(Parse(t, input))
> }
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
