# go-gorm/gorm #7014 — fix: use reflect.Append when preloading nested associations instead of making a slice with fixed size

**[View PR on GitHub](https://github.com/go-gorm/gorm/pull/7014)**

| | |
|---|---|
| **Author** | @emilienkofman |
| **Status** | Merged (by jinzhu on Jun 12, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @a631807682
> In fact, in most cases we cannot determine Len and Cap, and it is reasonable to provide a default Cap.

### @a631807682
> When `joins` relation is nil, we need to avoid `preload` nil values. This happens with `Joins` and `LeftJoins`. In this example, not all Users have Manager, so the panic occurs.

### @a631807682
> We can not specify the length of the slice and add it through `reflect.Append` based on conditional filtering.

### @emilienkofman
> Also, am I allowed to use testify/assert lib (it's quite common)

### @System-Glitch
> For now I have to downgrade to 1.12.9.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
