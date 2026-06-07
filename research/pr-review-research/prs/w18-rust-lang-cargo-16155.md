# rust-lang/cargo #16155 — Implement fine grain locking for build-dir

**[View PR on GitHub](https://github.com/rust-lang/cargo/pull/16155)**

| | |
|---|---|
| **Author** | @ranger-ross |
| **Status** | ✅ merged (2025-12-30) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Surface the known failure mode by reference (`epage` links a prior deadlock issue), and verify the defensive handling actually exists (unlock-on-failure) before approving.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@epage:**
> Have we double checked if we run into problems like #15698?

**@ranger-ross:**
> I went ahead and added logic to unlock the partial lock if we fail to take the full lock just in case.

**@epage:**
> [build-unit-level locking] requires more advanced mechanisms, but it avoids spreading uplifting complexity throughout the codebase — a worthwhile trade-off.

**@weihanglo:**
> The PR description is up-to-date, right?


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
