# sharkdp/bat #3438 — feat: make output pipeable with `-n`, non-auto styles

**[View PR on GitHub](https://github.com/sharkdp/bat/pull/3438)**

| | |
|---|---|
| **Author** | @lmmx |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @LangLangBart
> Until now, bat behaved predictably: it showed decorations only in interactive terminals, stripping them in non‑interactive output unless explicitly forced...The proposed change breaks this for some flags.

### @LangLangBart
> It makes bat's behavior more complex. The rule is no longer 'always act like cat when piped.' Instead, it becomes: 'act like cat when piped, unless you use --number...'

### @keith-hall
> as we have had a number of people open issues about it, and the wording in the documentation generally suggesting it should work the way it does in this PR...I'm going to merge it.

### @lokesh-balla
> The way I see it the decorations behave in a confusing way now...I always assumed not carrying decorations was deliberate choice to avoid issues when piped.

### @lmmx
> if someone explicitly asks for a style, honour it. This matches how other Unix tools work. `cat -n` preserves numbers when piped.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
