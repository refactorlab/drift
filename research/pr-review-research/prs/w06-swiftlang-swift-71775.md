# swiftlang/swift #71775 — Autodiff closure-specialization optimization pass

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/71775)**

| | |
|---|---|
| **Author** | @jkshtj |
| **Status** | ✅ merged (2024-05-10) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Compiler-craft canon from `eeckstein`: never iterate a Set/Dict (non-deterministic order breaks reproducible builds), split monolithic functions, and choose class-vs-struct on real cost. Domain invariants are a reviewer's highest-value contribution.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@eeckstein:**
> Never use a Set or Dictionary as collection. The order of values is non-deterministic.

**@eeckstein:**
> This function is really too big and therefore not readable. Suggestion: can you split it into the loop and the thing what you do for a closure instruction

**@eeckstein:**
> Classes have a performance overhead: memory allocation and reference counting. But if it's the right choice then it should be a class

**@eeckstein:**
> No need to use a Stack for the returned values... using a Stack will not save you any memory allocations


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
