# JuliaLang/julia #54372 — Add takestring!(x) to create a string from the content of x, emptying it

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/54372)**

| | |
|---|---|
| **Author** | @jakobnissen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stevengj
> The name makes me think that `take_string!(iobuffer)` should be a replacement/synonym for `String(take!(iobuffer))`?

### @jariji
> So what's the specification of `String(_)`: does it truncate or not? Or does it depend on the specific argument type? An 'it depends' is not a very nice property for generic programming.

### @oscardssmith
> Triage had a long talk about this...The conclusions we came to are 1. `String(Memory)` should copy 2. `String(Array)` should truncate the array but not the Memory...

### @JeffBezanson
> Why is `jl_genericmemory_to_string` (the no-copy path) only reachable if the io is writable?

### @nsajko
> Should `unsafe_takestring` be renamed to `unsafe_takestring!`?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
