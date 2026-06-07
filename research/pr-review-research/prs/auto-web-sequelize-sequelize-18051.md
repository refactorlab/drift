# sequelize/sequelize #18051 — feat(core): Convert query.js to typescript. Implemented Caching, Pooling, and other optimizations.

**[View PR on GitHub](https://github.com/sequelize/sequelize/pull/18051)**

| | |
|---|---|
| **Author** | @SippieCup |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @WikiRik
> Raised concern about unclosed bracket validation in the `undot.ts` utility, noting that malformed input like `"a[0"` would silently fail. The reviewer requested explicit validation after digit-reading loops to throw errors for unclosed brackets, emphasizing that defensive error handling matters even in performance-critical code.

### @coderabbitai
> Flagged that the object pooling strategy using `Object.keys()` and `delete` in loops could be slow. The bot suggested alternatives: either returning fresh objects and relying on garbage collection, or using tracked keys to clear only known properties instead of scanning all keys.

### @WikiRik
> Commented that the informal comment "LLMs said we need this. I'm not sure, but it seems like it won't hurt" should be replaced with clear technical explanation.

### @coderabbitai
> Suggested renaming the type `metaEntry` to `MetaEntry` per TypeScript conventions, noting that PascalCase for type names improves consistency with other definitions like `HashEntry` and `IncludeMap` in the codebase.

### @WikiRik
> Recommended improvements to eslint-disable comments, asking for specificity about *why* each rule is disabled rather than vague justifications, to aid future maintainers understanding the performance rationale.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
