# pmndrs/zustand #3246 — docs: created the new TypeScript Beginner Guide

**[View PR on GitHub](https://github.com/pmndrs/zustand/pull/3246)**

| | |
|---|---|
| **Author** | @yuraBezh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dai-shi
> Shouldn't TypeScript guide (for beginner or not) show `create<T>()(...)` usage?

### @dai-shi
> We should always tell `create<T>()(...)` for beginners. `create<T>(...)` works for some cases, but it's for advanced users.

### @dai-shi
> We don't recommend separating this. The extra parens `()` only exists because of TS limitation. Please stick with `create<T>()(...)` pattern throughout the guide.

### @dai-shi
> I don't prefer this separation either. Let's suggest `create<T>()(devtools(...))` pattern in the guide for all middleware.

### @dai-shi
> Should we only show the first method? Isn't it enough for beginners?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
