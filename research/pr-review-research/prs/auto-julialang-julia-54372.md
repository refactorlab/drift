# JuliaLang/julia #54372 — Add takestring!(x) to create a string from the content of x, emptying it

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/54372)**

| | |
|---|---|
| **Author** | @jakobnissen |
| **Status** | ✅ merged |
| **Opened** | 2024-05-06 |
| **Repo importance** | ★48,772 · 5,785 forks · score 76,892 |
| **Diff** | +220 / −78 across 39 files |
| **Engagement** | 41 conversation · 85 inline review comments |

## Top review comments (ranked by reactions)

### @stevengj — 5 reactions  
`👍 5`  ·  [link](https://github.com/JuliaLang/julia/pull/54372#issuecomment-2097050545)

> The name makes me think that `take_string!(iobuffer)` should be a replacement/synonym for `String(take!(iobuffer))`?

### @jakobnissen — 5 reactions  
`👍 5`  ·  [link](https://github.com/JuliaLang/julia/pull/54372#issuecomment-2099118043)

> It does not truncate - _except_ when the argument is a `Vector{UInt8}`. Yes, that's bad and in my opinion it shouldn't have been like that. But it's documented, and therefore can't change. I made this PR to make sure more exceptions aren't added.

### @jakobnissen — 5 reactions  
`👍 3 · ❤️ 2`  ·  [link](https://github.com/JuliaLang/julia/pull/54372#issuecomment-2105059874)

> After triage, this PR now contains the following changes:
> - [x] Add `takestring!`. This function can be used with `IOBuffer` and `Vector{UInt8}`, returning a `String`. It resets the input to its initial state. This means it empties vectors, and empties `IOBuffer` if and only if the buffer is writable. This behaviour of not empying the input if the input is not writable is slightly weird, but matches `take!`
> - [x] Add the internal methods  `Base.unsafe_takestring!` and `Base.unsafe_takestring`, which are similar to `takestring!`, except they leave the argument (`IOBuffer` or `Memory`) in an unusable corrupt state. They are useful for the common pattern when code creates a buffer, takes a string from the buffer and then returns the string without touching the buffer again.
> - [x] `String(::Memory)` now no longer truncates the memory
> - [x] `String(::Vector{UInt8})` now no longer truncates the underlying memory of the string. It still empties the vector, and assigns a new (empty) memory to the vector just like before.
> - [x] The many different calls to `String(take!(::IOBuffer))` and `String(_unsafe_take!(::IOBuffer))` has been replaced with `takestring!` and the two internal methods `Base.unsafe_takestring!` and `Base.unsafe_takestring`). Not all calls to `String(take!(...))` has been replaced, as there are many, _many_ of such calls in the test suite and no need to change them.
> - [x] Replace most uses of `String(take!(::IOBuffer)) in Base and the stdlibs`
> - [x] Add tests

### @stevengj — 3 reactions  
`👍 3`  ·  [link](https://github.com/JuliaLang/julia/pull/54372#issuecomment-2103309244)

> The [style guide](https://docs.julialang.org/en/v1/manual/style-guide/) says *not* to use underscores "when readable" without, which I think applies here.

### @topolarity — 2 reactions  
`👍 2`  ·  [link](https://github.com/JuliaLang/julia/pull/54372#issuecomment-2104924395)

> > 4. using the an Array aliased with another Array that is turned into a String is UB.
> 
> Can this be refined to "_mutating_ an Array after its alias has been turned into a String is UB"?
> 
> **edit:** For the record , I don't think it's right for us to put this contract on an API that's not marked `unsafe`. I expect that this 'contract' is broken much more often than the UB is actually triggered though, which is probably what's saving us in practice.

### @oscardssmith — 2 reactions  
`👍 2`  ·  [link](https://github.com/JuliaLang/julia/pull/54372#issuecomment-2828526645)

> @jakobnissen thanks so much for all your work here! The one request from triage was a rebase to 1 commit that implements the new functions and a 2nd that switches uses/docs over.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
