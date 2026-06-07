# serde-rs/serde #2980 — Use differently named __private module per patch release

**[View PR on GitHub](https://github.com/serde-rs/serde/pull/2980)**

| | |
|---|---|
| **Author** | @dtolnay |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @oli-obk
> As a defense against casual users of the private types? Because the same scheme can be used to keep using the private stuff in a downstream crate. Not sure this kind of extra defense is worth it

### @dtolnay
> I think it is low cost and decent benefit. If there is any logic in there that someone wants access to, they need to find someone to maintain it officially so that their users do not experience repeated breakage from serde updates.

### @juntyr
> As a maintainer of RON, this feels not good...Just breaking it entirely without a heads-up or alternative seems ... not good.

### @dtolnay
> What specifically is broken entirely without an available alternative? Is it basically just the `fn is_serde_content<T>()` that is mentioned in the linked issue?

### @juntyr
> RON required workarounds for untagged enums, internally tagged enums, and flattened structs that depended on internal type detection.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
