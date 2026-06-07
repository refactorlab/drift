# serde-rs/serde #2816 — Implement serialize/deserialize for core::net instead of std::net

**[View PR on GitHub](https://github.com/serde-rs/serde/pull/2816)**

| | |
|---|---|
| **Author** | @MathiasKoch |
| **Status** | Merged (published in 1.0.210) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MathiasKoch
> Implement serialize/deserialize for core::net instead of std::net, if running rust version newer than 1.77, where core::net was stabilized

### @dtolnay
> Thank you!

### @dtolnay
> Published in 1.0.210.

> Note: This was a clean, focused change (switching the impls from `std::net` to `core::net` behind a Rust 1.77 version gate for `no_std` support). It was reviewed by @oli-obk and @dtolnay and merged with little back-and-forth; the conversation page does not surface additional substantive inline review prose beyond the above.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
