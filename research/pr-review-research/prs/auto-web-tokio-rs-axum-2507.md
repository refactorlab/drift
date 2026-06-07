# tokio-rs/axum #2507 — Add Scheme extractor

**[View PR on GitHub](https://github.com/tokio-rs/axum/pull/2507)**

| | |
|---|---|
| **Author** | @bengsparks |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jplatte
> I think we've made a point to _not_ handle any conventional, or even standard headers for 'original' request data from proxies in `ConnectInfo`, because it can be spoofed at least in some cases.

### @sclu1034
> If you wanted to walk that path to the end, you'd have to remove the `Host` extractor entirely...the way I'd expect a security mitigation like this would be either some kind of middleware that I can deliberately add.

### @yanns
> One possible way to deal with that would be to expose the information as a method with a naming to indicate that this information can be 'dangerous' to use.

### @bengsparks
> Adding a separate method to indicate 'danger' goes against the spirit of extractors, whose intended usage is documented as 'reading via destructuring.'

### @jplatte
> Let's merge it but make an issue to revisit both `Host` and `Scheme` before v0.8.0?

### @mladedav
> We've moved the `Host` extractor to axum-extra and the last consensus was to put this there too.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
