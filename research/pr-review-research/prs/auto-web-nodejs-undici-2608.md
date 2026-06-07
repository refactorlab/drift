# nodejs/undici #2608 — feat: Implement EventSource

**[View PR on GitHub](https://github.com/nodejs/undici/pull/2608)**

| | |
|---|---|
| **Author** | @Uzlopak |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @KhafraDev
> private properties are fine and preferred :) regarding the WPTs we have our own test runner

### @KhafraDev
> currently the WPTs are failing because the WPTs use relative urls but you're not passing a base URL

### @mcollina
> Can you add TODOs to remove subarrays and concats for performance reasons?

### @KhafraDev
> we already drop those headers on cross-origin redirect

### @metcoder95
> So far LGTM, nice work @Uzlopak 🚀 I'd like to go on a second review

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
