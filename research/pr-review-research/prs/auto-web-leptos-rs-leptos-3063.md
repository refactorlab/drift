# leptos-rs/leptos #3063 — Makes the `wasm32-wasip1/2` target a first-class citizen for Leptos's Server-Side

**[View PR on GitHub](https://github.com/leptos-rs/leptos/pull/3063)**

| | |
|---|---|
| **Author** | @raskyld |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @benwis
> I think you want to take a look at leptos-spin and leptos-spin-macro. We're keeping most new integrations out of the main crates to reduce the time needed to release a new feature.

### @brooksmtownsend
> Once `wasm32-wasip2` is a stable target in Rust (coming in 1.82 afaik) the use of feature flags could be simplified, using the target directive instead.

### @brooksmtownsend
> Chiming in from the wasmCloud side, very in support of a `leptos-wasi` crate that uses wasm32-wasip2.

### @raskyld
> I really don't like my current changes

(regarding the single-threaded executor implementation in any_spawner, seeking maintainer guidance)

### @benwis
> LGTM! Thanks for all the hard work here!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
