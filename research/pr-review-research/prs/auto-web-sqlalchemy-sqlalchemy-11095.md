# sqlalchemy/sqlalchemy #11095 — session.begin()'s contextmanager should return type Self

**[View PR on GitHub](https://github.com/sqlalchemy/sqlalchemy/pull/11095)**

| | |
|---|---|
| **Author** | @drobert |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

This PR was a focused typing fix for issue #11083, changing the return type of `TransactionalContext.__enter__` from `TransactionalContext` to `Self`. The visible conversation was largely procedural (CI/Gerrit bot messages and brief approvals), so few substantive design comments are available.

### @CaselIT
> Thanks!

### @drobert
> noted fixing a "lint issue" before re-run

*Note: Beyond the reviewer approval from @CaselIT and a lint-fix note from the author, the conversation thread did not contain substantive design debate or requested-change discussion. Reviewers/participants recorded for completeness; the change itself was a straightforward `Self` return-type typing correction.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
