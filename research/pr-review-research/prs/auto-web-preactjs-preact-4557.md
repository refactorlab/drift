# preactjs/preact #4557 — feat: Add `ElementRef` type to compat

**[View PR on GitHub](https://github.com/preactjs/preact/pull/4557)**

| | |
|---|---|
| **Author** | @rschristian |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JoviDeCroock
> How does this behave in 5.0?

### @jakebailey
> you do not want to end up a situation where the types do not check without `skipLibCheck`

### @jakebailey
> not use relative paths in these handwritten files...you can duplicate everything as part of some build step

### @rschristian
> This has always been the case in Preact due to the limited aliasing mechanisms we have in TS

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
