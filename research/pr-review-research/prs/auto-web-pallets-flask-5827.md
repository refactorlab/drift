# pallets/flask #5827 — clarify 415 vs 400 errors for request.json

**[View PR on GitHub](https://github.com/pallets/flask/pull/5827)**

| | |
|---|---|
| **Author** | @adityasah104 |
| **Status** | Merged (by @davidism) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

*Note: The review-thread prose for this PR was not web-retrievable. The GitHub conversation page returned "Sorry, something went wrong" / "Uh oh! There was an error while loading" for the discussion sections, and the visible comments were marked off-topic with their text hidden. This file is recorded per instructions with the available facts.*

The only substantive content available is from the PR description itself: the change distinguishes between **415 Unsupported Media Type** (wrong `Content-Type`) and **400 Bad Request** (invalid JSON body) when calling `request.json`.

Reviewer/merger of record: **@davidism**.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
