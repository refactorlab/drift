# evanw/esbuild #3679 — fix #2388: allow consuming types without dom types

**[View PR on GitHub](https://github.com/evanw/esbuild/pull/3679)**

| | |
|---|---|
| **Author** | @remcohaszing |
| **Status** | Merged (March 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @evanw
> Ok, I can give this a try, but I reserve the right to revert this if it causes other problems. It looks like avoiding `dom` types also requires `URL` to be defined, so I'll add that too.

### @evanw
> Seems kind of weird for using esbuild to be polluting the global type scope, but I guess that's just how TypeScript works.

### @remcohaszing
> Nice catch! This is less apparent, as people often use the `dom` types or `@types/node`, both if which specify URL.

### @remcohaszing
> You can, but it's quite hacky. This only works from handwritten type definition files, not from TypeScript source files.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
