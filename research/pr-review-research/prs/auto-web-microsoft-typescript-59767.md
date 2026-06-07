# microsoft/TypeScript #59767 — Rewrite relative import extensions with flag

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/59767)**

| | |
|---|---|
| **Author** | @andrewbranch |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nicolo-ribaudo
> Does it mean that `require("./foo.ts")` will be rewritten if it's inside a JS file, but not if it's inside a TS file?

### @andrewbranch
> Plain `require` calls aren't recognized as special in TS files...in TS, `require` isn't even allowed unless it's declared as a global function.

### @sant123
> If a path contains `.jsx` it is preserved even with the `preserveJsx` argument. Should the regex be `/\.([jt]sx)$|...`?

### @nwidynski
> Shouldn't calls to `import.meta.resolve()`/`require.resolve()` also be shimmed as part of this flag?

### @jremy42
> Why is the .ts extension mandatory to transform it into .js?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
