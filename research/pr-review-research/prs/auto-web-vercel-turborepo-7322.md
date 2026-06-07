# vercel/turborepo #7322 — Improve daemon startup times

**[View PR on GitHub](https://github.com/vercel/turborepo/pull/7322)**

| | |
|---|---|
| **Author** | @arlyon |
| **Status** | Merged (February 15, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @NicholasLYang
> Expressed concern about potential deadlocking with `OptionalWatch` usage, asking "Are we ever holding a `Ref` across an `await`?"

### @arlyon
> Explained that Tokio requires all futures to be `Send`, meaning the compiler ensures a `Ref` is never held across an await point.

### @NicholasLYang
> Suggested wrapped types be "suffixed with `_lazy` or something similar" for clarity about data flow.

### @gsoltis
> Questioned whether moving file watching startup into the gRPC server constructor was the right architectural choice, noting it may need relocation if alternative APIs are added later.

### @arlyon
> Acknowledged that both approaches had merit and agreed components could be moved out when alternative communication mechanisms are implemented.

### @NicholasLYang
> Asked for clarification on initialization task purpose, questioning why initialization logic wasn't handled before the main watch loop begins.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
