# zellij-org/zellij #3349 — Switch from Wasmer to Wasmtime

**[View PR on GitHub](https://github.com/zellij-org/zellij/pull/3349)**

| | |
|---|---|
| **Author** | @bjorn3 |
| **Status** | Merged (June 28, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @imsnif
> I'm not enthusiastic about [the backwards compatibility break where file operations that worked in Wasmer now fail]. zjstatus is just one example that we happened to catch, I'm sure there are more [...] what other stuff breaks if we try to work around this problem.

### @imsnif
> Any idea why we need the increase here? [regarding e2e tests requiring increased sleep timing]

### @bjorn3
> [Explained the relative path file creation difference] Wasmer creates files in a virtual filesystem mounted at `/host`, while Wasmtime correctly rejects operations lacking pre-opened file descriptors, adhering to WASI spec intentions.

### @imsnif
> [Reported suspected plugin state reset behavior when new instances load, though this was later determined to be a configuration error on the reviewer's end.]

### @fitzgen
> [Wasmtime maintainer] Identified and fixed a critical race condition bug causing deallocation errors that manifested as "attempt to deallocate an entry that is already vacant" in production.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
