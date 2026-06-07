# opensearch-project/OpenSearch #12782 — [Writable Warm] Composite Directory implementation and integrating it with FileCache

**[View PR on GitHub](https://github.com/opensearch-project/OpenSearch/pull/12782)**

| | |
|---|---|
| **Author** | @rayshrey |
| **Status** | Merged (June 20, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> **Note:** On the rendered public conversation page most of the substantive review threads for this PR are collapsed as "Outdated" / "Show resolved", so the full verbatim prose was not available in the HTML snapshot. The reviewer threads below are identified from the rendered page, but the exact wording of each comment could not be extracted verbatim from the collapsed threads.

The active human reviewers and the topics they raised on this PR were:

- **@ankitkala** — questioned the architecture around file state management and how the composite directory handles concurrent access and state transitions during file operations (threads on `IndexService.java`, `CompositeDirectory.java`, `CompositeDirectoryFactory.java`).
- **@sarthakaggarwal97** — concerns about thread safety / locking and synchronization of cached file references across concurrent index operations (threads on `RemoteStoreRefreshListener.java`, `CompositeDirectory.java`).
- **@sachinpkale** — error handling and recovery: that fallback on-demand fetching might mask underlying storage issues rather than surfacing them.
- **@andrross** — performance of block-level fetching: whether the retrieval granularity balances efficiency against the overhead of many small file transfers.
- **@parasjain1** and **@nisgoel-amazon** — additional file-level review comments.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
