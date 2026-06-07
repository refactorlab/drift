# JuliaLang/julia #53719 — Canonicalize names of nested functions by keeping a more fine grained counter -- per (module, method name) pair

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/53719)**

| | |
|---|---|
| **Author** | @d-netto |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @vtjnash
> I think you need to keep this mostly inside flisp (particularly parsed_method_stack). I also don't think the module name has much value in being mangled into it... I don't really like that this adds more hidden and secret global statefulness to the lowering algorithm.

### @topolarity
> I don't like how this creates an implicit state internal to `ast.c` that has to be considered together with the program flow through the flisp for correct-ness. Is it not possible instead to pass a relevant stack of 'parent' functions through `cl-convert` and then into `current-julia-module-counter`, so that all of this is handled explicitly?

### @kpamnany
> Our goal here is to improve the consistency of the names generated for these functions... adding one lambda inside one function can change the generated names of _all_ nested functions across _all_ modules... This PR essentially makes the generated names/numbers independent of changes to other modules+functions.

### @vtjnash
> Could we use the bindings table to avoid needing this huge extra space?

### @JeffBezanson
> Looks good now, just needs finishing touches.

### @topolarity
> Thanks! This took some perseverance, but it's time to land.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
