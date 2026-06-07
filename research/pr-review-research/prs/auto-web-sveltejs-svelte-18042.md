# sveltejs/svelte #18042 — feat: custom renderers API

**[View PR on GitHub](https://github.com/sveltejs/svelte/pull/18042)**

| | |
|---|---|
| **Author** | @paoloricciuti |
| **Status** | Open |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Rich-Harris
> I don't love the fact that `createRenderer(methods)` returns `{ ...methods, render }` — in other words, both the renderer implementation _and_ the top-level API. It feels weird to me.

### @CristianRos
> Are lifecycle hooks like onMount/onDestroy exposed to renderer authors at all? Would it be feasible to add an optional async hook like beforeUnmount/beforeDestroy on the renderer API itself?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
