# leptos-rs/leptos #4273 — Resupport `From<Fn() -> T> for Signal<T>`, `ArcSignal<T>`, `Callback<T, _>` and similar

**[View PR on GitHub](https://github.com/leptos-rs/leptos/pull/4273)**

| | |
|---|---|
| **Author** | @zakstucke |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gbj
> I'm a little worried about the potential for this to break in subtle ways where the compiler can't infer the type of the marker.

### @gbj
> My only comment other than the individual nits is a bikeshedding one about the name: if we're putting it in the non-leptos-specific reactive_graph trait perhaps IntoReactiveValue?

### @maccesch
> We're actually using the same kind of trick with Effect since 0.7 that accepts a function with and without parameters. And I haven't come across a case yet where the compiler couldn't infer the marker type.

### @gbj
> I may be having trouble remembering the history here. Was the situation in 0.6 that Signal supported From<Fn() -> T> but it did not implement Fn() on nightly?

### @sabify
> I think the failed semver check is due to moving callback module from leptos to reactive_graph and it shouldn't be a false positive.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
