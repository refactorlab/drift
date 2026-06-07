# rust-lang/rust-clippy #15215 — New lint: `decimal_bitwise_operands`

**[View PR on GitHub](https://github.com/rust-lang/rust-clippy/pull/15215)**

| | |
|---|---|
| **Author** | @Artur-Sulej |
| **Status** | Merged (November 29, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ada4a
> please use `!e.span.from_expansion()` to filter those out

(Also noted issues with parenthesized literals and octal operands that should receive exceptions.)

### @ada4a
> You can use `SpanRangeExt::check_source_code` here to avoid allocating a `String`

### @llogiq
> I think that if we accept hex, we should also accept decimals up to 9. There is little benefit to require a `0x` prefix for e.g. `x & 5`.

### @llogiq
> Would it make sense to group 4 or at least 8 binary digits by underscore? Makes it easier to read and avoids having another lint triggering.

### @samueltardieu
> It would be interesting to preserve the suffix (for example `254_u32` should suggest `0xfe_u32`, etc.).

### @llogiq
> During the Final Comments Period, it was determined the lint should belong in the `pedantic` category rather than `nursery`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
