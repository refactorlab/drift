# hyperium/tonic #2363 — feat(grpc): add aggregate_states in child_manager

**[View PR on GitHub](https://github.com/hyperium/tonic/pull/2363)**

| | |
|---|---|
| **Author** | @cjqzhao |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

> Note: github.com/hyperium/tonic resolves to grpc/grpc-rust (the project was donated to the gRPC org). This is a current PR in that repository.

## Top review comments (most substantive, verbatim)

### @dfawley
> I think we also discussed offline that you would add the unit tests you have for this function?

### @easwars
> Also, please see if you can handle clippy warnings on lines that you have added/changed as part of this PR.

### @dfawley
> Does this work instead: `for endpoint in &resolver_update.endpoints`?

### @dfawley
> This is an incomplete comparison since it doesn't look at a field...We could even just derive this for `Endpoint` too.

### @easwars
> Maybe you don't need to register the builder for the tests...but I think ideally the stub builder should be registered with the LB policy registry.

### @easwars
> It feels like I still see a lot of lines which seem excessively long.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
