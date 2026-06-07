# redwoodjs/redwood #9883 — feat(middleware): Add support for Middleware to SSR-Streaming server

**[View PR on GitHub](https://github.com/redwoodjs/redwood/pull/9883)**

| | |
|---|---|
| **Author** | @dac09 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Tobbe
> What needs discussion? Can you and I discuss? I want to resolve this before merging

### @dac09
> I just want to call this out for awareness. It's harmless right now, but its possible a contribution or new code could leak information here.

### @Tobbe
> Multiple suggestions updating comments and types across AuthProvider and related files to improve code clarity and maintainability

### @dac09
> Applied Tobbe's suggestions for comment cleanup and implemented middleware invoke helper functionality based on review feedback

*Note: The two threads above (sanitization of `encryptedSession`/`cookieHeader` in the DOM) were the most substantive discussion; remaining feedback was inline type/comment cleanup.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
