# trpc/trpc #6134 — feat(tanstack-react-query): introduce `queryOptions` API in standalone package

**[View PR on GitHub](https://github.com/trpc/trpc/pull/6134)**

| | |
|---|---|
| **Author** | @juliusmarminge |
| **Status** | Merged (February 12, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @coderabbitai[bot] (design concern — unstable imports)
> The import from '@trpc/server/unstable-core-do-not-import' suggests using internal APIs that are not meant for public consumption.

### @coderabbitai[bot] (mutation handling)
> The mutation function should handle potential errors from the `mutate` call to prevent unhandled rejections.

### @coderabbitai[bot] (performance)
> The `onSuccess` callback is recreated on every render. Consider memoizing it for better performance.

### @coderabbitai[bot] (documentation)
> While the documentation is good, it could be improved by adding `@remarks` to explain when to use this override.

### @KATT
> let's go

(Approval signaling team confidence in the feature direction.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
