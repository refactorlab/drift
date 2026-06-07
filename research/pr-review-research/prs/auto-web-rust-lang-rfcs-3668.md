# rust-lang/rfcs #3668 — Async closures

**[View PR on GitHub](https://github.com/rust-lang/rfcs/pull/3668)**

| | |
|---|---|
| **Author** | @compiler-errors |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @programmerjake
> I think you should use `IntoFuture` instead of `Future` here, since it will allow passing more functions as `impl async Fn(..)`

### @compiler-errors
> There's a bit of friction introduced by making these traits harder to use with the ecosystem when calling functions that take `Future`s... you'll need to call `my_closure().into_future()`

### @Jules-Bertholet
> I don't think this `async Fn()` sugar pulls its weight versus `AsyncFn()`. It's an ad-hoc special case, doesn't fit with some wider language feature

### @compiler-errors
> If we stabilize `AsyncFn*` and we later want to unify the traits into `LendingFn`, we'd need to design some system of trait aliases... that's something I'm particularly keen to avoid

### @joshtriplett
> The concern about the proposed `async Fn` syntax has been captured in the RFC as an unresolved question... [@compiler-errors] stated that it'd be straightforward to have both syntaxes work on nightly

### @yoshuawuyts
> This RFC only expands the use of the `async` keyword as a modifier... crucially does not expose details about any underlying traits

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
