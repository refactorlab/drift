# microsoft/TypeScript #40336 — Template literal types and mapped type 'as' clauses

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/40336)**

| | |
|---|---|
| **Author** | @ahejlsberg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @taxilian
> It will be tricky to use this well without exceeding the '50 steps' limit with libraries like mongoose, but still will enable a lot of great things

### @bschlenk
> Will there be a way to add more modifiers? The times I've wanted this feature it's been to convert from ALL_CAPS to camelCase.

### @g-plane
> For the mapped type `as` clauses, the current behavior of compiler is... Why isn't `'a1' | 'a2' | 'b1' | 'b2'`?

### @danvk
> Is it possible to split a string literal type into a tuple of its characters? If you could split `'foo'` into `['f', 'oo']` then you wouldn't need to special case modifiers.

### @RyanCavanaugh
> Well, it doesn't. Your function in value space doesn't do anything to address string transforms in type space.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
