# junegunn/fzf #4534 — Introduce 'raw' mode

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4534)**

| | |
|---|---|
| **Author** | @junegunn |
| **Status** | Merged (Oct 8, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @LangLangBart
> Have you played around with the idea of stripping original colors to apply 'hidden' style uniformly?

### @LangLangBart
> When I run the command below and use the cursor the issue in the image below can be seen: seq 12 | FZF_DEFAULT_OPTS= fzf --raw --gutter-raw ''

### @alex-huff
> Either way, when the user returns to normal mode I think they want to be back where they were before entering raw mode.

### @alex-huff
> When you navigate around in raw mode with [half-]page-up/[half-]page-down you will likely skip over matches and land on unmatched items. When you switch back to normal mode would it make more sense to pick the closest matched item instead?

### @maxaykin
> When you reject a proposal because it does not comply with the original concept of fzf, please think of this 'raw' mode being introduced. It is probably out of the concept as well.

### @maxaykin
> My thought was that a jump to any (the nearest/next?) match would be better

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
