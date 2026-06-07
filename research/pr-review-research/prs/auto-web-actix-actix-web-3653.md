# actix/actix-web #3653 — Resolved collisions between `missing_docs` clippy lints

**[View PR on GitHub](https://github.com/actix/actix-web/pull/3653)**

| | |
|---|---|
| **Author** | @LucaCappelletti94 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @robjtede
> this is undesireable as it removes all the documentation for the quick httpresponse builders listed here

### @robjtede
> using `forbid(missing_docs)` feels like a misuse of forbid to me; `deny` is plenty and allows these overrides to work as intended

### @robjtede
> this is undesireable as it hides any copied documentation from handler functions

### @robjtede
> document your handlers so that the documentation is copied over to these generated structs, thus avoiding the lint errors

### @robjtede
> Okay, that's a bug then. As you can see from the line above your changes, the intention is to copy docs over.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
