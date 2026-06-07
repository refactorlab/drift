# preactjs/preact #4364 — feat: Support MathML namespace

**[View PR on GitHub](https://github.com/preactjs/preact/pull/4364)**

| | |
|---|---|
| **Author** | @rschristian |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JoviDeCroock
> Looks great, thank you for tackling this! I left two size-nits

### @lukewarlow
> I'm not super familiar with Preact internals but this change looks good overall to me. It touches the various places I found when reporting the issue. Perhaps some tests that handle conditional rendering would ensure context isn't lost in those cases?

### @rschristian
> Yeah that's fair -- will try to add later (for SVGs too)

### @rschristian
> Switching this to a ternary shaves off -6b or so but performs a fair bit worse.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
