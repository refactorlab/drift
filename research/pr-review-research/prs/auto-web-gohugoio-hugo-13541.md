# gohugoio/hugo #13541 — Reimplement and simplify Hugo's template system

**[View PR on GitHub](https://github.com/gohugoio/hugo/pull/13541)**

| | |
|---|---|
| **Author** | @bep |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmooring
> This is really, really good.

### @bep
> Note that this is still a draft; it's mostly working, but there's some TODOs sprinkled around, some commented out tests, and everything I say about shortcodes above isn't yet entirely true, but it will be.

### @jmooring
> All tests are green and I have completed my TODO list. I will do some more manual testing of this myself, but I would appreciate if you could take it for a spin, and especially see if you agree with my choices in the 'lookup department'.

### @jmooring
> (Identified a rendering issue where "head/css.html" was producing escaped HTML instead of proper styling, indicating an output format detection problem.)

### @bep
> The isn't entirely incorrect and comes from us now handling all templates more or less the same in this department, but I see that we need to add an additional check to make sure that the suffix matches the output format.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
