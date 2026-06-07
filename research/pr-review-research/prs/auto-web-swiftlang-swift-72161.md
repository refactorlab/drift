# swiftlang/swift #72161 — [android] add a module map for Android NDK

**[View PR on GitHub](https://github.com/swiftlang/swift/pull/72161)**

| | |
|---|---|
| **Author** | @hyp |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @etcwilde
> Seems mostly reasonable, what is the plan for selecting a given API level to build against?

### @compnerd
> The module triple strips the API level. This allows us to build the SDK against an API level that we want to support (I am currently leaning towards 28).

### @finagolfin
> Have you tried this pull with the C++ Interop tests on Android? Because they don't work with the current `SwiftGlibc.h` approach with NDK 26.

### @finagolfin
> Now that this new `SwiftAndroid` module includes all the same headers as the old `SwiftGlibc` module plus some extra Android headers, it is a drop-in replacement for `Glibc`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
