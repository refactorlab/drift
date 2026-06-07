# tauri-apps/tauri #14959 — refactor: replace `kuchikiki` with `dom_query`

**[View PR on GitHub](https://github.com/tauri-apps/tauri/pull/14959)**

| | |
|---|---|
| **Author** | @thomaseizinger |
| **Status** | ✅ merged |
| **Opened** | 2026-02-17 |
| **Repo importance** | ★107,509 · 3,672 forks · score 127,195 |
| **Diff** | +526 / −98 across 25 files |
| **Engagement** | 42 conversation · 19 inline review comments |

## Top review comments (ranked by reactions)

### @FabianLars — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/14959#issuecomment-4090450204)

> i'd still follow semver for external crates just to not make cargo's life harder than necessary but imo we don't need to follow tauri's version e.g. we can keep it in 0.x or like chrome on v145+ 🤷 
> 
> That would also make _some_ de-duplication possible assuming that not every single change we have there is breaking

### @thomaseizinger — 1 reactions  
`👍 1`  ·  [link](https://github.com/tauri-apps/tauri/pull/14959#issuecomment-4093694490)

> > An internal crate sounds good to me, but in the other hand, I never even realized that the tauri-utils crate is actually a public crate (and tauri even re-exports it) until recently say half a year ago 😂
> 
> I think that is the root of the issue here. utils crates are fine as long as you are not making them part of your public API. They are "public" in the sense of everyone can depend on it but the versioning doesn't matter then, right? It wouldn't matter if `tauri-utils` is version 37 as long as it is only used internally. That is what `tokio` and `tokio-util` are doing for example and I think that is a very sensible approach.

### @thomaseizinger — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/14959#issuecomment-3918792024)

> > Could we preserve the non mut version of those functions?
> 
> That is a bit tricky to do. We'd have to make a wrapper for the document that uses interior mutability. Is that something you want?

### @Legend-Master — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/14959#issuecomment-3919049533)

> > We'd have to make a wrapper for the document that uses interior mutability.
> 
> Doesn't `NodeRef` from `dom_query` already do that with its nodes?

### @thomaseizinger — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/14959#issuecomment-3919076924)

> > > We'd have to make a wrapper for the document that uses interior mutability.
> > 
> > Doesn't `NodeRef` from `dom_query` already do that with its nodes?
> 
> Yep, I just discovered that as well! Sorry for the bad first iteration.
> 
> I've revised this to not be mutable but it is still a breaking change because we used to have `kuchikiki`'s types in the API.

### @thomaseizinger — 0 reactions  
`—`  ·  [link](https://github.com/tauri-apps/tauri/pull/14959#issuecomment-3919101867)

> Not sure what to do about the CI failures regarding `serde`? Seems unrelated to this PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
