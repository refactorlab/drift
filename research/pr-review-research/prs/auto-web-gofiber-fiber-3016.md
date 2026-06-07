# gofiber/fiber #3016 — feat!(middleware/session): re-write session middleware with handler

**[View PR on GitHub](https://github.com/gofiber/fiber/pull/3016)**

| | |
|---|---|
| **Author** | @sixcolors |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sixcolors
> There is an issue with the way Fiber's storage adapters handle setting keys. The current operation for setting a key is an UPSERT, which means it will insert a new key if it does not exist or update it if it does.

_(Author-flagged design concern: with the new per-request save behavior, concurrent requests could undo a session destruction — a security-relevant race condition in the storage adapter UPSERT path.)_

### @gaby
> Those new sequence diagrams are awesome

### @renanbastos93
> Wow, you've been doing a good job. I commented on a few details.

### @sixcolors
> `session.NewWithStore()` allows access to both the middleware handler and the session store for CSRF integration

_(Note: This PR's review thread is dominated by coderabbitai[bot] line-comments. Human reviewers ReneWerner87, gaby, renanbastos93 and the author participated; the verbatim quotes above are the substantive human prose retrievable from the public conversation page via web fetch.)_

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
