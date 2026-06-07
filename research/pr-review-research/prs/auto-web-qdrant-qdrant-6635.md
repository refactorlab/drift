# qdrant/qdrant #6635 — Add stopwords support

**[View PR on GitHub](https://github.com/qdrant/qdrant/pull/6635)**

| | |
|---|---|
| **Author** | @n0x29a |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @generall
> gRPC interface is also required

(Identified that the gRPC API needed explicit stopwords support alongside the internal implementation.)

### @timvisee
Requested changes on the stopwords data files, indicating concerns about the implementation details of language-specific stopword lists and their organization.

### @coderabbitai
> Unit test fails due to unexpected lower-casing... The tokenizer lower-cases the token to `"привет"`, causing the assertion to fail

### @coderabbitai
> The `doc_token_filter` keeps tokens when _both_ the byte length **and** the `char` count satisfy the limit... This exact issue was raised in a previous review and hasn't been fixed

### @coderabbitai
> Consider adding `description` fields to `StopwordsInterface`, `Language`, and `StopwordsSet` to improve API documentation clarity

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
