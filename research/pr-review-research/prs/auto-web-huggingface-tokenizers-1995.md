# huggingface/tokenizers #1995 — Refactor a bit add_tokens logic: fix bytelevel decode of added tokens + less memory deserialization

**[View PR on GitHub](https://github.com/huggingface/tokenizers/pull/1995)**

| | |
|---|---|
| **Author** | @ArthurZucker |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @McPatate
> Suggested change: `tokens: impl IntoIterator<Item = AddedToken>`

(Requesting consistency with consuming iterators rather than borrowing, aligned with the PR's goal of reducing clones during deserialization.)

### @McPatate
> great stuff!

Note: This PR's review was relatively lightweight, consisting mostly of procedural/formatting suggestions. The most substantive exchange was @McPatate's iterator-consumption pattern recommendation above.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
