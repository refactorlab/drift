# nestjs/nest #13000 — fix(core,common): 🐛 missing registration handling of `SEARCH` http verb

**[View PR on GitHub](https://github.com/nestjs/nest/pull/13000)**

| | |
|---|---|
| **Author** | @doronguttman |
| **Status** | Merged (Feb 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Note: The inline review-comment threads on this PR would not render via web fetch (the comments section returned a persistent "There was an error while loading. Please reload this page." for the threads in `http-server.interface.ts` and `router-method-factory.ts`). No substantive review prose could be quoted verbatim. The following is the only recoverable context from the conversation page:

- The PR fixes issue #12998 ("Using `@Search()` controller method decorator hides any following endpoints"), where the missing `SEARCH` verb registration caused endpoints declared after a `@Search()` decorator to become inaccessible.
- Maintainer @kamilmysliwiec requested implementation refinements via code review; author @doronguttman force-pushed updates incorporating the feedback.
- @benjGam approved the changes on January 17, 2024; @kamilmysliwiec merged on February 7, 2024.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
