# WebKit/WebKit #51619 — [WTF] Make CStringView handle only null-termination methods

**[View PR on GitHub](https://github.com/WebKit/WebKit/pull/51619)**

| | |
|---|---|
| **Author** | @calvaris |
| **Status** | ✅ merged |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Senior reviewers steer toward safer primitives (`std::span` over a bloated class) and actively *contain* unsafe APIs so they don't spread.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@darinadler:**
> I don't think why we should continue to build this class CStringView with so many member functions; for 8-bit character views we should be using std::span<const char> or the same for each other character types...

**@geoffreygaren:**
> createWithoutCopying is not lifetime safe. We should not expand usage, and we should probably work to remove it.

**@darinadler:**
> Why do we want these functions to return a String rather than a CString or some other 8-bit string type?

**@darinadler:**
> we should use a SortedArrayMap and make that work with the appropriate span type; it would be straightforward.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
