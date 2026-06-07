# JetBrains/kotlin #5875 — [Wasm] Replace first stage test config with phased CLI infra (^KT-74671)

**[View PR on GitHub](https://github.com/JetBrains/kotlin/pull/5875)**

| | |
|---|---|
| **Author** | @jmrtsh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

*(This PR's reviewer threads are almost entirely resolved/outdated or pure `/final` approvals, so little verbatim reviewer prose is exposed on the public page. The substantive technical narrative available is the author's own debugging explanation.)*

### @jmrtsh
> Just creating this PR to be able to run CI - not finished yet. Implements KT-74671, and tries to simplify things between Js and Wasm test configs.

### @jmrtsh
> There were two separate problems: 1. I forgot to include the correct arguments for `WasmKlibCheckers.makeChecker` 2. I forgot to add the `IrDiagnosticsHandler` to the Wasm diagnostics test, causing the diagnostics to be never be collected from the diagnostics reporter

### @broadwaylamb
> /final

### @vsukharev
> /final

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
