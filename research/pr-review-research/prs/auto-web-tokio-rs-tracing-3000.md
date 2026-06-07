# tokio-rs/tracing #3000 — appender: Add fallback to file creation date

**[View PR on GitHub](https://github.com/tokio-rs/tracing/pull/3000)**

| | |
|---|---|
| **Author** | @kaffarell |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zerolfx
> You may need to handle the prefix and suffix before parsing the date (a reverse function of `join_date`).

### @zerolfx
> The prefix or suffix can also contain a dot.

### @mladedav
> I think you could have suffix `2024` and then files like `prefix-2024-01-01-2024` will get turned into `-01-01-2024`.

### @mladedav
> Wouldn't `strip_prefix` and `strip_suffix` work instead of `replacen`?

### @cyt-666
> not work when rotation is set to Rotation::DAILY...PrimitiveDateTime can not parse a str without time part.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
