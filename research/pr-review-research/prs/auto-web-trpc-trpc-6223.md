# trpc/trpc #6223 — chore(client): refactor & undeprecate `wsLink`

**[View PR on GitHub](https://github.com/trpc/trpc/pull/6223)**

| | |
|---|---|
| **Author** | @hmatthieu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @TomKaltz
> With the new wsLink in this pull request I'm now having an issue where the connectionParams message is not the first message sent over the wire...subscription messages are sent before the connectionParams message upon connection.

### @hmatthieu
> I'll look into it this week

(In response to the connectionParams ordering issue; later addressed in PR #6547.)

### @coderabbitai[bot]
> Replace instanceof Array with Array.isArray(). Using `instanceof Array` is unreliable as it returns false for array-like objects and arrays from other execution contexts.

### @coderabbitai[bot]
> Prevent race conditions in connection attempts. The `openPromise` is nullified in the `finally` block even if the connection fails, which could allow multiple simultaneous connection attempts.

### @coderabbitai[bot]
> Handle edge cases in flush method. The flush method should handle cleanup of existing pending requests to prevent memory leaks.

### @coderabbitai[bot]
> Avoid async event listener. Using an async function in the event listener could lead to error handling issues.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
