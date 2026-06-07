# encode/httpx #3367 — Ensure JSON representation is compact. #3363

**[View PR on GitHub](https://github.com/encode/httpx/pull/3367)**

| | |
|---|---|
| **Author** | @BERRADA-Omar |
| **Status** | Merged (Oct 28, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lovelydinosaur
> I've just noticed this accidentally snuck in a private import... would you be up for refactoring these tests? We can test this against public API using `httpx.Request()`.

### @Kludex
> This broke the test suite on Starlette.

### @beliaev-maksim
> This PR not only adjusts the ASCII representation but also alters the default JSON separators... resulting in altered validation hashes that broke some of our tests.

### @beliaev-maksim
> Providing a grace period for users can ease the process. E.g., introduce a warning and maintain it for two minor versions before enforcing.

### @lovelydinosaur
> CHANGELOG entry here is insufficiently emphasised. Not an API change, but nonetheless changes to representation-on-the-wire are likely to negatively impact teams.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
