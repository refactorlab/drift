# grpc/grpc-go #8074 — stats/opentelemetry: add trace event for name resolution delay

**[View PR on GitHub](https://github.com/grpc/grpc-go/pull/8074)**

| | |
|---|---|
| **Author** | @vinothkumarr227 |
| **Status** | Merged (April 4, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dfawley
> Nit: 'Should' implies uncertainty.

(suggesting change from "should be called" to "will be called" for clearer documentation semantics)

### @dfawley
> I think you want something more like this

(recommending refactored retry header parsing logic to properly extract and validate the attempt count from metadata)

### @dfawley
> This will have the same race as in the other tests. It should inject something to hook the resolver blocking, too.

### @dfawley
> Use: [AwaitState](https://pkg.go.dev/google.golang.org/grpc/internal/testutils#AwaitState) instead please

### @dfawley
> Why the `io.EOF` check here? The server should never exit until the client does `CloseSend`.

### @dfawley
> This is test code, so you don't need to even look at the error

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
