# vuejs/pinia #2983 — feat(warn): detect global context on the server side

**[View PR on GitHub](https://github.com/vuejs/pinia/pull/2983)**

| | |
|---|---|
| **Author** | @ivansky |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @posva
> This could be changed into a non breaking change by just showing an error and still returning the active pinia. The error should be in development only (like other warnings) and should not rely on `import` as it might not work in all scenarios

### @ivansky
> failing fast is the better approach when the global `activePinia` is accessed on the server, because: 1. failing immediately makes the problem obvious rather than silently continuing with potentially incorrect behavior. 2. allowing it to continue by returning `activePinia` could lead to dangerous state sharing between requests

### @ivansky
> developers tend to ignore error messages, so they will make the same mistakes again and again, I would prefer it to fail that will indicate the mistake much faster

### @posva
> That would be a breaking change. Also, I do prefer the error message because it feels less frustrating to users

### @iPrytz
> Perfect @ivansky ! This would be great to have at least a warning. Would also have preferred the throw error but anything is better than nothing.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
