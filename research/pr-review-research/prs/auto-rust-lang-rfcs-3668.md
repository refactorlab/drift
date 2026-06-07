# rust-lang/rfcs #3668 — Async closures

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3668)**

| | |
|---|---|
| **Author** | @compiler-errors |
| **Status** | ✅ merged |
| **Opened** | 2024-07-01 |
| **Repo** | curated review-culture seed |
| **Diff** | +733 / −0 across 1 files |
| **Engagement** | 32 conversation · 121 inline review comments |

## Top review comments (ranked by reactions)

### @compiler-errors — 10 reactions  
`👍 9 · 👀 1`  ·  [link](https://github.com/rust-lang/rfcs/pull/3668#issuecomment-2201860363)

> > It's an ad-hoc special case, doesn't fit with some wider language feature, and might even conflict with a hypothetical future effects/keyword generics feature
> 
> If we did introduce an `async` bound modifier with a different set of semantics than how users observe `async Fn()`, that would probably suggest there's a problem with the keyword generics feature, not `async Fn()`.
> 
> We're reserving quite a lot of space for `async Fn()`'s desugaring to change in the future specifically by reserving the trait definition, and while we should be mindful of future extensions, I don't think stabilizing `AsyncFn` as the name now to save space for a potentially different `async Fn()` (with possibly different semantics in the future?!) is the right move.
> 
> > It mentions the wrong trait, misleading anyone who tries to look for it in rustdoc
> 
> I'm not super convinced that users (except for the curious ones) really care about looking at the `Fn*` trait definitions themselves for the purposes of learning. When they do look up `Fn*` in rustdoc, I assume they care more about the specific docs that discuss, e.g., the relationship between the traits and their restrictions for calling, rather than the exact trait definition, since none of the trait's methods (or its `extern "rust-call"` calling convention) are even usable directly.
> 
> If we find out that users are confusingly going to the `FnOnce` docs for `async FnOnce`, we can mention in the rustdocs for `FnOnce` that `async` is a trait bound modifier for it and link to `AsyncFnOnce`. Something like "`FnOnce` takes an optional `async` keyword that cu … *[truncated]*

### @joshtriplett — 8 reactions  
`👍 8`  ·  [link](https://github.com/rust-lang/rfcs/pull/3668#issuecomment-2229830528)

> I've now gotten a chance to read through the entire RFC.
> 
> @rfcbot resolved need-time-to-read
> @rfcbot reviewed
> 
> Thank you for working on this, @compiler-errors!
> 
> ---
> 
> I appreciate the explanation of why we need `async ||` and why `|| async` does not suffice and cannot be made to suffice. And even in a hypothetical world in which we *did* somehow solve that, `async ||` also has the advantage of being able to write a type signature that includes the future's output type, like an `async fn`: `async |args| -> Type { ... }`. As long as we have `async fn`, it makes sense for us to have `async ||`.
> 
> So, :+1: for adding the `async ||` and `async move ||` closure syntaxes.
> 
> ---
> 
> I also think it makes sense, for now, to avoid stabilizing the methods, associated types, and generic parameters of the `AsyncFn*` traits. We're likely to want some of those eventually, but they're not critical to have immediately. And we can potentially extend RTN syntax to let people name these types, as well, whether or not we expose them directly as associated types.
> 
> ---
> 
> After reading through the RFC and thinking about the experience of potential users, I don't think we should introduce the `async FnOnce(Args) -> Ret` syntax (and the analogous syntax for `FnMut` and `Fn`. Instead, I think we should use `AsyncFnOnce(Args) -> Ret` and similar, allowing people to name the trait using that syntax (but *not* the methods or associated types). That syntax is already a syntactic sugar, like the one for the `Fn*` traits, so there are *multiple* ways we can keep that syntax working regardless of what future trait … *[truncated]*

### @traviscross — 7 reactions  
`🎉 7`  ·  [link](https://github.com/rust-lang/rfcs/pull/3668#issuecomment-2266358248)

> The lang team has accepted this RFC, and we've now **merged it**.
> 
> Thanks to @compiler-errors for pushing forward this important work, and thanks to all those who reviewed the RFC and provided useful feedback.
> 
> For further updates, please follow the tracking issue:
> 
> - https://github.com/rust-lang/rust/issues/62290

### @compiler-errors — 6 reactions  
`👍 4 · 😄 2`  ·  [link](https://github.com/rust-lang/rfcs/pull/3668#issuecomment-2212066122)

> > First, I personally am very skeptical that having a separate set of traits for async functions is not the right choice in the long-term (because ideally we do better to generalize to a LendingFn, or better somehow adjust the Fn traits themselves). So, I'm glad that this remains an implementation detail for now and the traits are not nameable.
> 
> While I appreciate the input regarding being skeptical of `AsyncFn*` being the actual backing traits for async closures (which I also am skeptical about them being, in the long term!), I do want to repeat that the fact that they exist in the current implementation is purely an implementation detail and should have no bearing on the user-facing contents of this RFC.
> 
> > Are these currently separate feature gates?
> 
> The traits themselves are indeed gated under the library feature `async_fn_traits`, and will likely remain so for the foreseeable future.
> 
> > It would be good to get some nightly usage on this to get a feel.
> 
> I'm not sure what you mean by nightly usage -- are you talking about the nightly usage of the `async_fn_traits` library feature gate? In other words, whether users have decided to name them via `AsyncFn` or `async Fn` in their (nightly) code? 
> 
> It would be great if someone could get those numbers, but I don't believe that that should have a particularly strong weight on the choice of whether or not to have `async` fn trait bound modifiers, given that both `async Fn` and `AsyncFn` have only existed for like 6 months at this point and we haven't really been advertising them.
> 
> ...and if not for that `async Fn` vs `AsyncFn` … *[truncated]*

### @yoshuawuyts — 6 reactions  
`👍 1 · ❤️ 5`  ·  [link](https://github.com/rust-lang/rfcs/pull/3668#issuecomment-2255956221)

> There have been some questions raised both in this thread and other places about the forward-compatibility of this design with a possible Effect Generics design. The Effects Initiative has discussed this and as far as we can tell, this RFC does not pose any forward-compatibility concerns. From the [Future Possibilities](https://github.com/compiler-errors/rust-rfcs/blob/async-closure-redux/text/3668-async-closures.md#future-possibilities) section of this RFC:
> 
> > ### `async` bound modifier on arbitrary traits
> >
> > There has been previous discussion of allowing `async` trait bounds on arbitrary traits, possibly based off a `?async` maybe-async genericity system.
> > 
> > This RFC neither requires this more general extension to the language to be implemented, nor does it necessarily preclude this being an eventual possibility, since `AsyncFn*` remains unstable to implement.
> 
> We agree with this assessment. This RFC only expands the use of the `async` keyword as a modifier to existing language items. It crucially does not expose details about any underlying traits. As written this design neither closes any doors to-, nor requires a further generalization of `async` in trait bounds or declarations. From an Effect Generics perspective, we're happy with this RFC.

### @eholk — 5 reactions  
`👍 5`  ·  [link](https://github.com/rust-lang/rfcs/pull/3668#issuecomment-2201368958)

> In my experience lately, it's generally more flexible to use the `Into*` variants of various traits, so I've started encouraging people to do that. But the `*` version is often a lot more natural so I often forget to use it. In the ideal world, it seems like having async closures and `async fn` return `IntoFuture` would be better.
> 
> I think @compiler-errors raises some good points about the migration. Lots of code is already written to take a `Future`, so we'd be adding a little friction there.
> 
> I also agree that having asymmetry between `async fn` and `async ||` would not be great.
> 
> So given the state of things, it's probably better to treat the return `IntoFuture` question as a separate one and handle all the migration concerns at once. Since we've already shipped `async fn`, we aren't really making things harder for ourselves if we ship `async ||` now.
> 
> Is there a way we could signal to the ecosystem that we'd like them to migrate towards taking `IntoFuture` instead of `Future` where possible, so that it's more feasible we could make this change later?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
