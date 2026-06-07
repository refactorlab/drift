# microsoft/TypeScript #57847 — Control flow analysis for element access with variable index

**[View PR on GitHub](https://github.com/microsoft/TypeScript/pull/57847)**

| | |
|---|---|
| **Author** | @ahejlsberg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jakebailey
> Does it make more sense to do `isPastLastAssignment` using a more specific location? How does this PR interact with #56908?

### @ahejlsberg
> Unfortunately not that simple. We would need to know that _all_ narrowing operations for `obj[key]` occur past the last assignment to `key` which would require an additional CFA graph walk.

### @jakebailey
> Weird; reading some of the breaks, there seems to be a bug in this iteration of the PR where unrelated accesses are getting narrowed too.

### @ahejlsberg
> Argh, I see what the issue is. Will fix.

### @jakebailey
> Can you add a test in the vein of #56908 in terms of what closures do?

### @ahejlsberg
> Such a test wouldn't show anything. The new analysis in #56908 only affects references to local variables, not references to properties.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
