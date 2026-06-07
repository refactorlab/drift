# eslint/eslint #18352 — feat: add suggestions to no-unused-vars

**[View PR on GitHub](https://github.com/eslint/eslint/pull/18352)**

| | |
|---|---|
| **Author** | @Tanujkanti4441 |
| **Status** | ✅ merged (2024-12-09) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> A thorough review is three distinct passes: performance (cache `node.parent`), correctness edge-cases (deeper nesting; an invalid auto-fix), and coverage (99 untested lines). One reviewer rarely catches all three — a panel does.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@nzakas:**
> It looks like you're using node.parent a lot, which requires looking up that property each time. I'd suggest saving a reference to both the parent and parent type so you don't have to keep evaluating it.

**@mdjermanovic:**
> The current implementation provides a suggestion to fix const [[foo]] = bar; ... but it doesn't provide a suggestion to fix const [[[foo]]] = bar;

**@fasttime:**
> There are 99 lines never hit by a test case, all but one in the new code... you could figure that out quickly since you are already familiar with the logic.

**@mdjermanovic:**
> There's also a bug when params with default values are being removed: function foo(x = 1) {} fixed to: function foo( = 1) {}


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
