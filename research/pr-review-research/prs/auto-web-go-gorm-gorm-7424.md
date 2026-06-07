# go-gorm/gorm #7424 — (WIP) Implement Generics API

**[View PR on GitHub](https://github.com/go-gorm/gorm/pull/7424)**

| | |
|---|---|
| **Author** | @jinzhu |
| **Status** | Merged (May 25, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @a631807682
> It may be necessary to add unit tests for nested join/preload. For generics API, how should we reuse it? (Similar to the original Session)

### @a631807682
> I think the generics API is simple enough without polluting the db.

### @NeariX67
> I am currently adopting to the generics branch and noticed that there is no .ToSQL() method... .Save(), .Pluck() and .FirstOrCreate() are also missing

### @jinzhu
> FirstOrCreate and Save are convenience APIs, but they can be misleading... Our goal is to take a more restrained approach to API design to help avoid potential misuse.

### @Allendar
> Updates(ctx context.Context, t T) should be a pointer like so; Updates(ctx context.Context, t *T)

### @Allendar
> Also the Association is not available on purpose in Generics?... Yes, it's not included yet—I'm still considering if there's a better way to handle associations.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
