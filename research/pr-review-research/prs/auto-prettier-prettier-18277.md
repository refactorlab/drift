# prettier/prettier #18277 — Upgrade to latest micromark (markdown only)

**[View PR on GitHub](https://github.com/prettier/prettier/pull/18277)**

| | |
|---|---|
| **Author** | @fisker |
| **Status** | ✅ merged |
| **Opened** | 2025-11-18 |
| **Repo** | curated review-culture seed |
| **Diff** | +6978 / −630 across 84 files |
| **Engagement** | 52 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @karlhorky — 9 reactions  
`👍 3 · ❤️ 2 · 🚀 2 · 👀 2`  ·  [link](https://github.com/prettier/prettier/pull/18277#issuecomment-3693915763)

> @fisker @seiyab congratulations getting a PR merged in the direction of getting new MDX versions supported! 🙌 🎉
> 
> Looking forward to this landing in a Prettier version!
> 
> cc @wooorm @ChristianMurphy @remcohaszing in case you weren't following along already

### @tats-u — 2 reactions  
`👍 2`  ·  [link](https://github.com/prettier/prettier/pull/18277#issuecomment-3641249446)

> Before format: https://spec.commonmark.org/dingus/?text=-%201%0A%20%20%20%20foo%0A-%202%5C%0A%20%20%20%20bar
> After format: https://spec.commonmark.org/dingus/?text=-%201%0A%20%20foo%0A-%202%5C%0A%20%20bar%0A
> After format (stable): https://spec.commonmark.org/dingus/?text=-%201%0A%20%20foo%0A-%202%5C%0A%20%20%20bar%0A
> 
> Leading ASCII spaces in a paragraph line are ignored by CommonMark. Both yield the same HTML.
> 
> Update: CSS (not HTML itself) also ignores such spaces.

### @fisker — 2 reactions  
`🚀 2`  ·  [link](https://github.com/prettier/prettier/pull/18277#issuecomment-3692459115)

> @seiyab 
> 
> I plan to merge this PR and continue work on the MDX upgrade. Do you have any work left that you want to finish before I merge?
> 
> Are you fine with squashing all these changes into one commit?

### @fisker — 1 reactions  
`👍 1`  ·  [link](https://github.com/prettier/prettier/pull/18277#issuecomment-3548328128)

> @seiyab I pushed [`cebe353` (#18277)](https://github.com/prettier/prettier/pull/18277/commits/cebe3533cff952253800e74b49a939470978c010), to make sure we don't touch old logic for `mdx`.

### @fisker — 1 reactions  
`👍 1`  ·  [link](https://github.com/prettier/prettier/pull/18277#issuecomment-3589278469)

> # Wiki link including line break
> 
> > Option 2. Own wiki link plugin to allow line break
> 
> This seems a good choice.

### @fisker — 1 reactions  
`👍 1`  ·  [link](https://github.com/prettier/prettier/pull/18277#issuecomment-3589281726)

> # Indented code after list
> 
> Option 1.  seems reasonable to me. The other two doesn't. (Just first hunch)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
