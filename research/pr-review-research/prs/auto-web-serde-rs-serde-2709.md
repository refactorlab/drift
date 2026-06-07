# serde-rs/serde #2709 — Implement Ser+De for Saturating<T>

**[View PR on GitHub](https://github.com/serde-rs/serde/pull/2709)**

| | |
|---|---|
| **Author** | @jbethune |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @oli-obk
> We do version detection in build.rs... Please use that scheme to register a new cfg and put your new additions behind such a cfg

### @oli-obk
> [Requested changes to] the deserialization code so that it maps exceedingly large or small values to the `MAX` and `MIN` values

### @dtolnay
> I think it would help to understand more about your use case where these impls are going to be needed.

### @jbethune
> I'm making a game for a virtual 16 bit architecture with number semantics that saturate at `2^16-1`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
