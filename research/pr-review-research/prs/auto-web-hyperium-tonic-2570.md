# hyperium/tonic #2570 — feat(grpc): Implement PickFirst load balancer

**[View PR on GitHub](https://github.com/hyperium/tonic/pull/2570)**

| | |
|---|---|
| **Author** | @nathanielford |
| **Status** | Merged (by dfawley on May 22, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

> Note: github.com/hyperium/tonic resolves to grpc/grpc-rust (the project was donated to the gRPC org). This is a current PR in that repository.

## Top review comments (most substantive, verbatim)

### @dfawley
> Good catch. Tokio only runs tests with a single thread, so there's no way for the code under test to fail if the thread is blocked...I've replaced everything to use helpers to pull from the channel.

### @arjan-bal
> We should use `tokio::time::timeout` or `tokio::time::sleep` to avoid blocking the entire thread.

### @arjan-bal
> Non-test changes look good. Left some minor comments on the test code.

### @dfawley
> ordering::relaxed is fine for this

### @arjan-bal
> Leaving initial comments while I review the remaining changes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
