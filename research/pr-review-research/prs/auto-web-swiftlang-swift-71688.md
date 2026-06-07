# swiftlang/swift #71688 — [stdlib] Start adopting noncopyable generics in the stdlib

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/71688)**

| | |
|---|---|
| **Author** | @lorentey |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Azoy
> Would it be worth putting this in `LegacyABI.swift` instead to clear up this file a little?

### @lorentey
> Yes, but let's wait for the dust to settle a bit.

### @lorentey
> The API-level ABI checker does not understand the weird semantics of our new marker protocols, so it is becoming completely useless at this point.

### @lorentey
> By mistake, `UnsafeMutablePointer.initialize(to:)` was originally defined to take a `__shared` argument. This PR changes its new version to take a `consuming` parameter.

### @kavon
> I think we just diagnose one property and stop. I guess we could diagnose all of the noncopyable properties preventing conformance

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
