# rust-lang/rust #49878 — libcore: Add VaList and variadic arg handling intrinsics

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/49878)**

| | |
|---|---|
| **Author** | @dlrobertson |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nagisa
> I would probably prefer to see the full implementation before landing, rather than doing it in parts.

### @eddyb
> I wonder why this enum was added, instead of determining this information from the architecture, in the call ABI infrastructure.

### @eddyb
> Ideally VaList would be an extern type always behind a &mut, but can it be?

### @eddyb
> You don't need to alloca in either case, you have llresult to write the destination to (after which you use return, I believe.

### @eddyb
> I think you should match on result.layout.ty.sty for ty::Adt(def, _) and compare def.did with did instead of calling type_of.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
