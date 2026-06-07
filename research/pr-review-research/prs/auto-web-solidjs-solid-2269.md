# solidjs/solid #2269 — update dom-expressions, solid-js/web, solid-js/html, solid-js/store to make the exports isomorphic

**[View PR on GitHub](https://github.com/solidjs/solid/pull/2269)**

| | |
|---|---|
| **Author** | @trusktr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ryansolid
> This seems fine to me and honestly I think I'm ok even making them throw if called. I don't see any reason why these should ever be called on the server with a server build.

### @ryansolid
> To be fair a lot of these methods still work on the server but just don't do anything. Like modifyMutable being missing is an oversight and should just function the same as in the client.

### @trusktr
> These functions override the error-throwing functions that are now exported from dom-expressions, making this particular set of functions be no-ops instead of throwing errors.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
