# JuliaLang/julia #53719 — Canonicalize names of nested functions by keeping a more fine grained counter -- per (module, method name) pair

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/53719)**

| | |
|---|---|
| **Author** | @d-netto |
| **Status** | ✅ merged |
| **Opened** | 2024-03-13 |
| **Repo importance** | ★48,772 · 5,785 forks · score 76,892 |
| **Diff** | +193 / −48 across 7 files |
| **Engagement** | 20 conversation · 90 inline review comments |

## Top review comments (ranked by reactions)

### @d-netto — 1 reactions  
`👍 1`  ·  [link](https://github.com/JuliaLang/julia/pull/53719#issuecomment-2048154215)

> > The solution would seem to be either to:
> > - Add specific serialization support for counter_table to preserve it across the serialization boundary, OR
> > - Check in the binding table directly for type name collisions
> 
> Did a mix of both and lazily reconstructed the `counter_table` of a freshly serialized module through successive lookups in the binding table.
> 
> Performance doesn't seem terrible, but a few parts could probably be optimized.

### @d-netto — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53719#issuecomment-1994284566)

> `Serialization` doesn't seem happy with this PR...

### @kpamnany — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53719#issuecomment-2009977969)

> > I think you need to keep this mostly inside flisp (particularly parsed_method_stack). I also don't think the module name has much value in being mangled into it. Making the name be a combination of the containing method + index into that method name seems somewhat prettier, I also don't see how that canonicalizes names any more than before. I don't really like that this adds more hidden and secret global statefulness to the lowering algorithm as well.
> 
> @vtjnash: to reiterate, our goal here is to improve the consistency of the names generated for these functions. Currently, adding one lambda inside one function can change the generated names of _all_ nested functions across _all_ modules in our application, which means that a number of the `precompile` statements emitted via `--trace-compile` by the previous version will fail on the new version.
> 
> This PR essentially makes the generated names/numbers independent of changes to other modules+functions.
> 
> Do you see any other way for us to accomplish this or does this explanation address your objection(s)?

### @kpamnany — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53719#issuecomment-2015570357)

> We've tested this change by exercising it through compilation warmup in our application. Without this, we saw roughly 53% warmup effectiveness when upgrading versions. With this, we're seeing 68% warmup effectiveness. Although this comparison is not quite apples-to-apples, there is a notable reduction in `precompile` evaluation failures across versions and warmed up performance has improved. So this is a good change for us.

### @kpamnany — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53719#issuecomment-2021319389)

> Ran more tests to verify the gains from this and have verified that this is a positive change for us.
> 
> Any objections to merging @JeffBezanson?

### @d-netto — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53719#issuecomment-2031047946)

> > Could we use the bindings table to avoid needing this huge extra space?
> 
> Not sure if I get it?
> 
> The current implementation stores one extra hash table per module, and each hash table will have an entry for every top-level method name.
> 
> This doesn't seem that concerning from a memory consumption point of view, but I might be wrong.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
