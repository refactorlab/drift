# uutils/coreutils #8833 — Improve sort buffer sizing heuristics and honor explicit --buffer-size

**[View PR on GitHub](https://github.com/uutils/coreutils/pull/8833)**

| | |
|---|---|
| **Author** | @mattsu2020 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sylvestre
> i was already not convinced in #8802 but there is probably a better way than parsing /proc/meminfo esp in the sort.rs code

### @sylvestre
> I said it in the other pr but it does not belong to sort but uucore And maybe we already have such functions

### @sylvestre
> please use the one from workspace

### @sylvestre
> can you use nix instead of libc here? it will probably remove unsafe

### @sylvestre
> Now, I don't want the merge these 54 commits or squash into one. Could you please clean it up? First, uucore, then memory functions and the rest

### @sylvestre
> please document this and maybe it would make sense to move these memory functions into a specific file

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
