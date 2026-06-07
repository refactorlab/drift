# jestjs/jest #16074 — feat: support `require(esm)`

**[View PR on GitHub](https://github.com/jestjs/jest/pull/16074)**

| | |
|---|---|
| **Author** | @SimenB |
| **Status** | Merged (May 1, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmuransky
> Everything else looks fine. Though the support is still not enough for me. Funnily the error I am getting is probably from nodejs: Cannot require() ES Module FILE synchronously...

### @jmuransky
> Do we maybe want to handle case, where this function identifies code as cjs (using .js and package.json does not have type:'module'), but is actually esm?

### @SimenB
> That's [link to code showing try/catch logic], no? Or am I misunderstanding?

### @jmuransky
> Well I tried to write fixture to test this case and it failed. I'll have a better look at this and see if I did it wrong or if I found a case where it does not apply

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
