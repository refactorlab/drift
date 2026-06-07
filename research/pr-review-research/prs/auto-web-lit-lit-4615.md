# lit/lit #4615 — Add @lit-labs/signals package

**[View PR on GitHub](https://github.com/lit/lit/pull/4615)**

| | |
|---|---|
| **Author** | @justinfagnani |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sorvell
> For watch, let's consider @e111077's feedback and maybe have a way to auto-wrap a function (maybe if it's not an event part?). And I really like using the `html` and not manually watching but if we do that probably want `unwatched` which is just basically an echoing directive.

### @e111077
> The memory approach is clever. Wonder if we might run into issues down the line with watchers running unnecessarily because of FinalizationRegistry timing. Though only things I could think of that might run into that are users writing brittle code that is probably in need of a rewrite anyway

### @e111077
> All my comments at this point are just doc nits. Code looks good to me

### @justinfagnani
> I rewrote most of SignalWatcher and I think simplified things a lot, and I added a bunch of comments, so hopefully it's easier to follow now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
