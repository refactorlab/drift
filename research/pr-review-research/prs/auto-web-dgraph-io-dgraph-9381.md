# dgraph-io/dgraph #9381 — feat: add import api support for multiple groups with a single alphas

**[View PR on GitHub](https://github.com/dgraph-io/dgraph/pull/9381)**

| | |
|---|---|
| **Author** | @shivaji-kharse |
| **Status** | Merged (May 11, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> **Note:** The public conversation page did not expose the verbatim text of the threaded review comments — they render as collapsed/resolved inline review threads ("hidden conversations… Load more") on the HTML page. The substantive review activity is summarized below by reviewer. Lead reviewer **@mangalaman93** requested changes across multiple rounds (Apr 24, Apr 29, May 5, May 7) before approving with "LGTM!" on May 11; the feedback centered on `dgraph/cmd/dgraphimport/import_client.go` and `worker/import.go`, plus protobuf and cluster-configuration details. **@xqqp** suggested changes to `import_client.go`. Automated reviews came from Copilot AI and github-advanced-security. The PR scope was explicitly limited: "It only works with a single Alpha or a multi-shard single Alpha cluster" (no HA support).

### @mangalaman93
> LGTM!

### @mangalaman93
> (Multiple "Requested changes" review rounds on `import_client.go` and `worker/import.go`; verbatim inline text not exposed on the HTML conversation page.)

### @xqqp
> (Suggested changes to `import_client.go`; verbatim inline text not exposed on the HTML conversation page.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
