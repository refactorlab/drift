# reduxjs/redux-toolkit #4393 — [API Concept] - Infinite Query API

**[View PR on GitHub](https://github.com/reduxjs/redux-toolkit/pull/4393)**

| | |
|---|---|
| **Author** | @riqts |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @markerikson
> This ought to work as part of the UI-agnostic RTKQ core, so that any UI layer can use it (React, Angular, etc).

### @phryneas
> I happen to like SWR's infinite query API a bit better...the fact that it treats all pages as individuals, gives you the ability to refetch only individual pages.

### @kcrwfrd
> We have a direct message UI...using the merge strategy...now we have to iterate through them all in order to find the entity to update/delete, and we're left with a dilemma of where to add new messages.

### @TkDodo
> The only safe thing to do is to refetch all pages when you refetch an infinite query, from the start.

### @phryneas
> That could be done without iterating, with provides containing ids, and selectInvalidatedBy.

### @markerikson
> The development work for the infinite query feature has moved to a new running integration PR: RTKQ Infinite Query integration #4738

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
