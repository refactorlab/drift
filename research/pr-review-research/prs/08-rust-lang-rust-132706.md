# rust-lang/rust #132706 — Stabilize async closures (RFC 3668)

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/132706)**

| | |
|---|---|
| **Author** | @compiler-errors |
| **Status** | ✅ merged |
| **Opened** | 2024-11-06 |
| **Diff** | +314 / −555 across 185 files |
| **Engagement** | 30 conversation comments · 3 inline review comments |

## Why this PR is notable

Stabilizing async closures (RFC 3668). Beyond the green checkmark, `joshtriplett` turns the thread toward rollout — *'we're going to need a large dedicated blog post… discussing how people can use it.'*

## 🧠 The lesson for reviewers

> Part of reviewing a milestone is planning the **rollout**: docs, migration guidance, and announcement. Shipping the code is only half the change.

## How the author framed it (PR description excerpt)

> # Async Closures Stabilization Report
> 
> This report proposes the stabilization of `#![feature(async_closure)]` ([RFC 3668](https://rust-lang.github.io/rfcs/3668-async-closures.html)). This is a long-awaited feature that increases the expressiveness of the Rust language and fills a pressing gap in the async ecosystem.
> 
> ## Stabilization summary
> 
> * You can write async closures like `async || {}` which return futures that can borrow from their captures and can be higher-ranked in their argument lifetimes. 
> * You can express trait bounds for these async closures using the `AsyncFn` family of traits, analogous to the `Fn` family.
> 
> ```rust
> async fn takes_an_async_fn(f: impl AsyncFn(&str)) {
>     futures::join(f("hello"), f("world")).await;
> }
> 
> takes_an_async_fn(async |s| { other_fn(s).await }).await;
> ```
> 
> ## Motivation
> 
> Without this feature, users hit two major obstacles when writing async code that uses closures and `Fn` trait bounds:
> 
> - The inability to express higher-ranked async function signatures.
> - That closures cannot return futures that borrow from the closure captures.
> 
> That is, for the first, we cannot write:
> 
> ```rust
> // We cannot express higher-ranked async function signatures.
> async fn f<Fut>(_: impl for<'a> Fn(&'a u8) -> Fut)
> where
>     Fut: Future<Output = ()>,
> { todo!() }
> 
> async fn main() {
>     async fn g(_: &u8) { todo!() }
>     f(g).await;
>     //~^ ERROR mismatched types
>     //~| ERROR one type is more general than the other
> }
> ```
> 
> And for the second, we cannot write:
> 
> ```rust
> // Closures cannot return futures that borrow closure captures.
> async fn f<Fut: Future<Output = ()>>(_: impl FnMut() -> Fut)
> { todo!() }
> 
> async fn main() {
>     let mut xs = vec![];
>     f(|| as …​ *[truncated]*

## Highest-signal comments (ranked by reactions)

### @camsteffen — 15 reactions  
`👍 11 · ❤️ 4`  ·  [link](https://github.com/rust-lang/rust/pull/132706#issuecomment-2461313181)

> > This is a long-awaited feature
> 
> Oh but we've only just begun!


### @joshtriplett — 5 reactions  
`👍 5`  ·  [link](https://github.com/rust-lang/rust/pull/132706#issuecomment-2474091134)

> Huge appreciation for all the effort people have put into this.
> 
> I think we're going to need a large dedicated blog post announcing this feature, discussing in detail:
> 
> - How people can use it in new crates, in cases where they previously might have used `|| async move` or similar.
> - How existing crates may be able to migrate existing APIs using traits.
> - Hints of the future big picture, but that should be a separate post down the road a bit.
> - And, of course, highlighting and centering all the work that has gone into this, particularly the extensive work of @compiler-errors.


### @Veykril — 4 reactions  
`👍 1 · ❤️ 2 · 👀 1`  ·  [link](https://github.com/rust-lang/rust/pull/132706#issuecomment-2514452348)

> ~~I do wanna raise that rust-analyzer probably has zero support for most of the things being stabilized here and so it might be spewing a bunch of diagnostics with code using async closures (as well as unknown/error types when called),~~
> 
> This has been investigated and the main annoyances have been worked out https://github.com/rust-lang/rust-analyzer/pull/18594


### @tmandry — 2 reactions  
`❤️ 1 · 🎉 1`  ·  [link](https://github.com/rust-lang/rust/pull/132706#issuecomment-2483855967)

> The work on this feature and the stabilization report has been top-notch, and I am excited to ship this. Thank you @compiler-errors!
> 
> @rfcbot reviewed


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
