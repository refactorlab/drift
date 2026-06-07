# leptos-rs/leptos #3640 — Erased mode in CI

**[View PR on GitHub](https://github.com/leptos-rs/leptos/pull/3640)**

| | |
|---|---|
| **Author** | @zakstucke |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sabify
> IMO, naming 'dev_mode' is a bit misleading since you can be in dev mode without activating the erase_components cfg flag.

### @sabify
> The only issue is that it is only running over member crates and not examples. I don't know if it is intended for that.

### @benwis
> There is a part of me that finds the idea of the CI just up and deciding it's done compiling and to start the tests is hilarious.

### @zakstucke
> It's not an issue with erased mode, but a rust limitation where if you cross compile...the proc macro doesn't respect RUSTFLAGS

### @sabify
> Have you tried transparent route component (#[component(transparent)])? I guess it does work without needing to modify the macro...

### @sabify
> How about adding `CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS`...besides `RUSTFLAGS`?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
