# apache/druid #16667 — Do not kill segments with referenced load specs from deep storage

**[View PR on GitHub](https://github.com/apache/druid/pull/16667)**

| | |
|---|---|
| **Author** | @AmatyaAvadhanula |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

_Note: The GitHub conversation page repeatedly returned a loading error ("There was an error while loading. Please reload this page") across fetch attempts, so the verbatim review-comment text could not be captured._

**Reviewers identified on the PR:**

- **@abhishekrb19** — left review comments
- **@kfaraz** — approved these changes

The PR concerns preventing kill tasks from deleting segments whose load specs are still referenced from deep storage (related to segment upgrades).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
