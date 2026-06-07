# lit/lit #4755 — [labs/ssr] Implement SSR custom elements event handling

**[View PR on GitHub](https://github.com/lit/lit/pull/4755)**

| | |
|---|---|
| **Author** | @kyubisation |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @justinfagnani
> Over the weekend I realized that this implementation will not work, if a consumer uses their own polyfill for `HTMLElement`.

### @sorvell
> Would this mean that in the case the elements are not slotted, a sibling's parent node would be incorrectly set to its `previousElementSibling`?

### @bennypowers
> it will default to eventTarget, which is the result of `getLast(renderInfo.eventTargetStack)` - can that end up being the previous element sibling?

### @sorvell
> Just a couple questions, very close!

### @justinfagnani
> Thanks so much for your work an patience here!!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
