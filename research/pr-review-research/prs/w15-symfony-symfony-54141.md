# symfony/symfony #54141 — [Messenger] Introduce DeduplicateMiddleware

**[View PR on GitHub](https://github.com/symfony/symfony/pull/54141)**

| | |
|---|---|
| **Author** | @VincentLanglet |
| **Status** | ✅ merged (2025-02-07) · 👍11 ❤️1 👀1 |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Naming is review-worthy. Two reviewers independently flag that the name misleads (Lock vs Deduplicate) — a misleading name is a real defect because it misshapes every future reader's mental model.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@jderusse:**
> I wonder if this should be named LockMiddleware or DeduplicationMiddleware. At first I thought this PR was about avoid processing similar messages in parallel.

**@pounard:**
> The 'Lock' term may mislead to 'contention' or 'conflict' problem resolution... but in my opinion doesn't ring any bell about deduplication.

**@jderusse:**
> I think this is not necessary, the check is performed in the releaseLock method. Also, it's not consistent with the call.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
