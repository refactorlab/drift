# vuejs/core #5912 — feat(reactivity): more efficient reactivity system

**[View PR on GitHub](https://github.com/vuejs/core/pull/5912)**

| | |
|---|---|
| **Author** | @johnsoncodehk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @skirtles-code
> I think this may cause problems in cases that rely on the laziness of `computed` evaluation to avoid errors.

### @skirtles-code
> The underlying problem here is that, in some cases, computed properties have now switched from being lazily evaluated to eagerly evaluated. `c.value` is being accessed even though it isn't used.

### @basvanmeurs
> This computed sorts someArray in place, which means it always returns the same reference. Since 3.4 computeds have become lazy. If the result is equal (as in this case, given it is the same reference) it will not trigger deps.

### @Anoesj
> Is it possible to implement this behavior by default or would the `isEqual` call have a too big performance impact?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
