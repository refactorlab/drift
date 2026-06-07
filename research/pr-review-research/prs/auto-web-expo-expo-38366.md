# expo/expo #38366 — [expo-blob] Added ExpoBlob package

**[View PR on GitHub](https://github.com/expo/expo/pull/38366)**

| | |
|---|---|
| **Author** | @arturgesiarz |
| **Status** | Merged (Aug 7, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> **Note:** This PR (156 comments, 54 commits) carried most of its review discussion in inline code-review threads that GitHub had marked **resolved/outdated** and collapsed; their verbatim prose was not retrievable from the public HTML without a token. The substantive design rationale that remained web-visible is captured below, along with the reviewers who participated.

### @arturgesiarz (author, on UTF-8 handling in Swift)
> The current implementation already uses the failable String(data:encoding:) initializer as the primary method, which is the preferred approach according to `SwiftLint` guidelines. However, we need a fallback mechanism to handle invalid UTF-8 sequences properly.

### Reviewers who participated (threads collapsed/resolved, prose not web-retrievable)
- @aleqsio
- @amandeepmittal
- @Simek
- @jakex7
- @lukmccall

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
