# pmndrs/jotai #3150 — breaking: drop atom.unstable_is

**[View PR on GitHub](https://github.com/pmndrs/jotai/pull/3150)**

| | |
|---|---|
| **Author** | @dai-shi |
| **Status** | Merged (September 24, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: The conversation contained no substantive design debate; discussion centered on ecosystem compatibility and environment-specific (ubuntu vs macos) test failures rather than code-review objections.

### @dai-shi
> It was an experimental feature of jotai-scope, which is no longer required.

### @dai-shi
> This requires jotai-effect change. @dmaskasky

### @arjunvegda
> This is strange! Passes locally for me 🤔

### @dai-shi
> It might be the difference between ubuntu and macos. You don't run jest in your ci, do?

### @arjunvegda
> The `^` in `package.json` was causing automatic minor version updates

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
