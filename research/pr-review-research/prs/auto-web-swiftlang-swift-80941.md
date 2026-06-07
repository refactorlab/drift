# swiftlang/swift #80941 — [SE-0489] Better `debugDescription` for `EncodingError` and `DecodingError`

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/80941)**

| | |
|---|---|
| **Author** | @ZevEisenberg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kperryua
> It seems like a lone `CodingKey` ought to have a more complete description than just `"[0]"` or `"keyName"`. Could this instead be a separate property?

### @kperryua
> At present, that might involve some duplication of code between `CodingKey` and JSONDecoder / PropertyListDecoder / etc. unless/until that format can be wrapped in some API

### @stephentyrone
> We've already branched, so if the intention is for this to go into 6.2 it will need a cherry-pick for the release/6.2 branch after landing on main.

### @lorentey
> we stick to Explicit Access Modifiers. These help make our intention clearer, and they help us to avoid common mistakes as we read and modify this code

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
