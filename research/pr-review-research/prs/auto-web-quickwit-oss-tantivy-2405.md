# quickwit-oss/tantivy #2405 — feat(query): Make `BooleanQuery` supports `minimum_number_should_match`

**[View PR on GitHub](https://github.com/quickwit-oss/tantivy/pull/2405)**

| | |
|---|---|
| **Author** | @LebranceBW |
| **Status** | Merged (July 1, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fulmicoton
> Very solid first PR! Good job. Please have a look at the comments.

### @PSeitz
> you can just create or append and not reassign the variable

### @PSeitz
> I left a comment to simplify the code regarding `FullIntersection`

Note: @fulmicoton conducted an extensive initial review across boolean_query.rs, boolean_weight.rs, and disjunction.rs with numerous inline implementation comments; much of that line-level text was marked outdated in the final merged version.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
