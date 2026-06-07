# opensearch-project/OpenSearch #13897 — QueryGroup Resource Tracking framework and implementation

**[View PR on GitHub](https://github.com/opensearch-project/OpenSearch/pull/13897)**

| | |
|---|---|
| **Author** | @kiranprakash154 |
| **Status** | Merged (August 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> **Note:** On the rendered conversation page, the substantive review threads on this PR (primarily from @kaushalmahi12) are collapsed as "Outdated" / "Show resolved", and the page indicates additional "7 hidden conversations". The full verbatim prose of those threads was not available in the HTML snapshot, so the items below describe the reviewer and the topic raised rather than exact quotes.

The active human reviewer and the topics raised on this PR were:

- **@kaushalmahi12** — design/encapsulation: ensure proper encapsulation and avoid exposing internal state of the tracking framework unnecessarily.
- **@kaushalmahi12** — thread-safety: verify thread-safety mechanisms for concurrent access during multi-threaded query execution.
- **@kaushalmahi12** — separation of concerns: separate resource tracking from usage-view construction to improve modularity.
- **@kaushalmahi12** — testing: add comprehensive test cases covering edge cases and error scenarios across resource types.
- **@kiranprakash154** (author self-review) — remove experimental code and finalize the core tracking interface before broader adoption.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
