# rust-lang/rust #139493 — Explicitly export core and std macros

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/139493)**

| | |
|---|---|
| **Author** | @Voultapher |
| **Status** | ✅ merged |
| **Opened** | 2025-04-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +770 / −123 across 103 files |
| **Engagement** | 243 conversation · 62 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @petrochenkov — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/rust/pull/139493#issuecomment-2786935083)

> There's an issue for this change - https://github.com/rust-lang/rust/issues/53977.

### @dtolnay — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/rust/pull/139493#issuecomment-2786947029)

> @Voultapher, avoiding the vec module re-export can be done like this:
> 
> ```rust
> #[macro_export]
> macro_rules! myvec {
>     () => {};
> }
> 
> pub mod myvec {
>     pub struct Vec;
> }
> 
> pub mod prelude {
>     // Bad: re-exports both macro and type namespace
>     // pub use crate::myvec;
>     
>     mod vec_macro_only {
>         #[allow(hidden_glob_reexports)]
>         mod myvec {}
>         pub use crate::*;
>     }
>     pub use self::vec_macro_only::myvec;
> }
> 
> fn main() {
>     prelude::myvec!();
>     let _: prelude::myvec::Vec; // error
> }
> ```
> 
> https://play.rust-lang.org/?version=stable&mode=debug&edition=2024&gist=5e50828c593e04ba0e98f48c9d8696b4

### @petrochenkov — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/rust/pull/139493#issuecomment-2796660751)

> Exporting the std panic explicitly `pub use super::v1::panic;` should shadow the glob and avoid the warning.

### @petrochenkov — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rust-lang/rust/pull/139493#issuecomment-2932510370)

> The `private_macro_use` lint is fixed in https://github.com/rust-lang/rust/pull/141934.
> @rustbot blocked

### @petrochenkov — 1 reactions  
`👍 1`  ·  [link](https://github.com/rust-lang/rust/pull/139493#issuecomment-3381725071)

> I again suggest splitting this work into two parts - first moving everything except panic, and then dealing with panic separately.

### @Voultapher — 0 reactions  
`—`  ·  [link](https://github.com/rust-lang/rust/pull/139493#issuecomment-2785949847)

> @Amanieu  the tidy issue highlights an annoying and unforeseen side-effect of this change. The `vec` module is now part of the prelude. In effect this means that for example this code:
> 
> ```rust
> fn xx(i: vec::IntoIter<i32>) {
>     let _ = i.as_slice();
> }
> 
> fn main() {}
> ```
> 
> that currently doesn't compile on stable would now compile. Initially I thought this would cause name collisions if users define their own `vec` module but so far I wasn't able to produce those, it seems to always prefer the local module. But regardless, I think we don't want to allow access to a standard library namespace without going through `std`, `alloc` or `core`. AFAIK there is no way to pub use only the macro and not the module namespace without modifications. I have two ideas how to tackle this, maybe we can rename vec to vec_xx internally and have separate use expressions or we have to add another crate that we can `#[macro_use]` inject into the prelude that only contains the `vec` macro. Thoughts?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
