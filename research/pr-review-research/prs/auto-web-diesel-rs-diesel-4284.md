# diesel-rs/diesel #4284 — Add SQLite support for serde_json::Value using the Json/Jsonb

**[View PR on GitHub](https://github.com/diesel-rs/diesel/pull/4284)**

| | |
|---|---|
| **Author** | @JMLX42 |
| **Status** | Merged (October 2, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @weiznich
> we need to adjust the (de)serialization of the jsonb type to match the actual underlying SQLite data format. Additionally tests + documentation need some tweaks.

### @weiznich
> I think we still should improve the test situation by adding more tests for jsonb roundtrips...the handling of escaped string sequences is still missing from the parser/writer implementation.

### @weiznich
> I would like to see an entry into the `Changelog.md` file...at least a handful tests that...verify that loading values also works.

### @weiznich
> the `Jsonb` type shouldn't be gated behind the `serde_json` feature. Only the actual `ToSql`/`FromSql` impls...should be gated.

### @weiznich
> Thanks for fixing and thanks again for working on this...The next step...is to add definitions for the built-in SQL functions to diesel.

### @sofiaritz
> Noted documentation comment should reference "SQLite" rather than "PostgreSQL" in the module header.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
