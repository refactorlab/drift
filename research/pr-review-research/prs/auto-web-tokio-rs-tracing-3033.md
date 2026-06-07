# tokio-rs/tracing #3033 — subscriber: update matchers to 0.2

**[View PR on GitHub](https://github.com/tokio-rs/tracing/pull/3033)**

| | |
|---|---|
| **Author** | @oscargus |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hawkw
> the `matchers::BuildError` type doesn't implement `std::error::Error`, which breaks some code that uses `?` on it in a method that returns `Box<dyn Error + Send + Sync>`

### @sophie-h
> Why not go with the 90 loc in #2945 if this needs extra code anyways?

### @BurntSushi
> this error type is on the `FromStr` impl for `MatchPattern` and `MatchPattern` is not part of the public API. So this change should be okay.

### @oscargus
> It seems like one can add a dependency on `regex_automata` with the std feature if one would like to avoid bumping `regex`?

### @asomers
> Is there any chance we can get this merged? It's still resulting in a lot of binary bloat downstream.

### @hds
> Looks good. Thank you for your work on this one!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
