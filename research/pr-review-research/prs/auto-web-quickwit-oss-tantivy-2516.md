# quickwit-oss/tantivy #2516 — add RegexPhraseQuery

**[View PR on GitHub](https://github.com/quickwit-oss/tantivy/pull/2516)**

| | |
|---|---|
| **Author** | @PSeitz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @fulmicoton
> why `max_doc + 1`

### @PSeitz
> BitSet excludes max_doc. We may want to change that, it could be a source of bugs

### @fulmicoton
> What requires this?

### @PSeitz
> In the BitSetPostingUnion, we need to `seek` in the docset list, since we arrive at a hit from the bitset...

### @fulmicoton
> And you don't want to make that update on `.advance()` calls, because this computation is somewhat expensive...

### @fulmicoton
> I think the point of this was to avoid paying for the position check if we have deletes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
