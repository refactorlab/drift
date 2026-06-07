# lit/lit #4515 — [labs/ssr] fix patched directives memory leak

**[View PR on GitHub](https://github.com/lit/lit/pull/4515)**

| | |
|---|---|
| **Author** | @AndrewJakubowicz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @justinfagnani
> apply Justin's suggested solution to simplify the patching. Note, this has to be done in a way that is backwards compatible.

### @augustjk
> I looked into whether it might be better to add the sentinel property in `overrideDirectiveResolve` but that lives in `lit-html` exported via private-ssr support so it seems better to keep everything in this ssr package.

### @augustjk
> LGTM

### @justinfagnani
> nice work!

> **Note:** Several inline threads (requesting changes around the patching implementation and the prototype-walking approach across multiple review rounds) were summarized rather than rendered verbatim on the fetched conversation page.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
