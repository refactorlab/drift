# tokio-rs/tracing #3243 — subscriber: use state machine to parse `EnvFilter` directives

**[View PR on GitHub](https://github.com/tokio-rs/tracing/pull/3243)**

| | |
|---|---|
| **Author** | @djc |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dpc
> Benchmark 2: ./target/release/dotr-after ran 2.03 ± 0.34 times faster than ./target/release/dotr-before

### @klensy
> After this, `regex` can be removed from Cargo.toml (for tracing-subscriber), only left in dev-deps?

### @hds
> Could you please rebase this against `master`. We merge everything in there first and then David or I will handle backporting to `v0.1.x`.

### @hds
> Before making this change, I think we need more tests to ensure that the behavior isn't changing...there are things I'm seeing in the code that are different to what the docs say.

### @hds
> I think we need to match the previous regex here...we should not be more restrictive

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
