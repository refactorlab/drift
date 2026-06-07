# gofiber/fiber #3434 — 🔥 feat: Add Support for service dependencies

**[View PR on GitHub](https://github.com/gofiber/fiber/pull/3434)**

| | |
|---|---|
| **Author** | @mdelapenya |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

_Note: The verbatim prose of substantive HUMAN review comments on this PR was not retrievable via web fetch. The visible review thread on the public conversation page is dominated by automated reviewers (coderabbitai[bot] and Copilot AI), which are excluded per collection rules. Their (paraphrased) concerns covered: using a background context without timeout for dependency startup/shutdown, inconsistent context-cancellation error handling between the start and shutdown paths, a doc reference to `fiber.RuntimeDependency` that should read `fiber.DevTimeDependency`, a flaky 1-nanosecond test timeout, and a suggested middleware-based dependency-injection pattern instead of app state._

### Human review participants
- **@gaby**, **@ReneWerner87**, **@efectn** — listed as reviewers / participated in review assignment for this `v3` service-dependencies feature. Their individual comment prose was not web-retrievable from the conversation page (dynamic rendering of a 128-comment thread).
- **@mdelapenya** — PR author.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
