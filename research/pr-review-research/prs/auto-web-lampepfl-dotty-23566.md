# lampepfl/dotty #23566 — Explicitly null check the stdlib

**[View PR on GitHub](https://github.com/lampepfl/dotty/pull/23566)**

| | |
|---|---|
| **Author** | @hamzaremmal |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sjrd
> It would make the body inconsistent with its typing. Constant-folding in the compiler could for example mis-'optimize' `x == null` as `false`...

(Argued against forbidding nulls in converter signatures, emphasizing types should describe actual contracts, not impose stricter constraints.)

### @olhotak
> I wonder if we could do some kind of trick like `mapNull`, with match types, to give `asScala` a null-polymorphic signature...

(Suggested using match types for null-aware signatures to reduce `.nn` usage in downstream code.)

### @noti0na1
> Add `.nn` only when the value is logically guaranteed to be non-null at that point; it asserts non-null immediately.

(Provided migration guidelines emphasizing preserving behavior, careful `.nn` placement, and using `| Null` when logic depends on nullability.)

### @lihaoyi
> ...should this have been squash-merged instead of merged directly? Right now the `main` branch contains all your manual UI edits and reverts as separate commits.

(Flagged that many intermediate development commits polluted the main branch history.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
