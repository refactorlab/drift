# diesel-rs/diesel #3951 — Add Postgres COPY FROM/TO support

**[View PR on GitHub](https://github.com/diesel-rs/diesel/pull/3951)**

| | |
|---|---|
| **Author** | @weiznich |
| **Status** | Merged (April 10, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JosueMolinaMorales
> Is there a reason for not including `HEADER`, `FORCE_QUOTE`, `ENCODING`, etc?

(Weiznich explained these were deferred for the initial version due to implementation complexity.)

### @pppp24
> what would happen in the event this line does not get called as a result of the '?' on line 164?

(Concerned proper cleanup of PostgreSQL connections, which was subsequently addressed.)

### @peasee
> .expect() in a `Result<_>`. Ditto for above, could we map this to an error?

(Weiznich clarified that expect() was intentionally used for internal diesel bugs versus user-facing errors.)

### @peasee
> why do we do `command: CopyToCommand<T>` vs the `copy_from` function above which does `target: S`?

(Weiznich explained the structural differences between struct-based and trait-based generics.)

### @peasee
> Should we give these `.expect()`'s a better error message?

(This discussion established patterns for distinguishing recoverable user errors from unrecoverable internal bugs.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
