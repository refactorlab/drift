# dgraph-io/dgraph #9406 — Add support for HA and multishard functionality in import APIs

**[View PR on GitHub](https://github.com/dgraph-io/dgraph/pull/9406)**

| | |
|---|---|
| **Author** | @shivaji-kharse |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> **Note:** The public conversation page exposed only the automated Copilot review verbatim; the human threaded review comments render collapsed ("hidden conversations… Load more") on the HTML page. Lead reviewer **@mangalaman93** requested changes multiple times, with discussion focused on `import_client.go`, `import_test.go`, and `worker/import.go`; the verbatim text of those human comments was not accessible from the page.

### @Copilot (automated review)
> The removal of sending the acknowledgment using stream.SendAndClose in this function appears to be intentional given the updated flow in InStream. Please verify that the ACK signal is being sent exactly once during stream processing to avoid protocol inconsistencies.

### @mangalaman93
> (Multiple "Requested changes" review rounds on `import_client.go`, `import_test.go`, and `worker/import.go`; verbatim inline text not exposed on the HTML conversation page.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
