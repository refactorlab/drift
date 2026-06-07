# honojs/hono #2813 — feat(middleware): Introduce IP Restriction Middleware

**[View PR on GitHub](https://github.com/honojs/hono/pull/2813)**

| | |
|---|---|
| **Author** | @nakasyou |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @usualoma
> Is 'Wildcard' an important feature of this middleware? This is because, although the use of wildcards is seen as customary, I do not believe that such a notation is defined as an official specification.

### @usualoma
> By the way, I was thinking, what about turning this middleware into a middleware for 'access control' that is not limited to IP addresses?

### @ryuapp
> IMO, it is necessary to improve naming convention, since it is APIs that is exposed externally as part of utils.

### @MathurAditya724
> Amazing middleware! A small suggestion I would like to add, can we have a custom error handler function in the options?

### @yusukebe
> Great! It looks good to me. The CI is falling, but we can remove the error. Then, I'll merge this into the `next` later.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
