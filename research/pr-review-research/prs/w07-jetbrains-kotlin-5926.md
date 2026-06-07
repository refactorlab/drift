# JetBrains/kotlin #5926 — [BTA] Prepare BTA/JS for integration into KGP

**[View PR on GitHub](https://github.com/JetBrains/kotlin/pull/5926)**

| | |
|---|---|
| **Author** | @wojtek-kalicinski |
| **Status** | ✅ merged (2026-05-15) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Small clarity/consistency nits — needless scope functions, undocumented conditional flags — compound into long-term maintainability. The unglamorous review that keeps a codebase legible.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@ALikhachev:**
> It feels irrelevant to use also here... Does usage of scope function even makes sense here?

**@ALikhachev:**
> I think it's worth clarifying when and why allowArgFileInValues = false should be used... it may be unclear if one should pass it here or not.

**@ywett02:**
> What about treating @something always as a file and forcing a different usage if the at is supposed to be a part of the value?

**@Tapchicoma:**
> Nit: please use the Gradle version catalog


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
