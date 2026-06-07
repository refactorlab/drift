# rust-lang/rust #146923 — Reflection MVP

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/146923)**

| | |
|---|---|
| **Author** | @oli-obk |
| **Status** | ✅ merged |
| **Opened** | 2025-09-23 |
| **Diff** | +475 / −53 across 31 files |
| **Engagement** | 49 conversation comments · 52 inline review comments |

## Why this PR is notable

An experimental Reflection MVP. `RalfJung`'s pinned comment fences the scope: *'This is an MVP. Please do not flood this PR with all your wildest reflection dreams. Anything that suggests to extend the scope of this PR is off-topic.'*

## 🧠 The lesson for reviewers

> **Scope discipline is a review skill.** Explicitly fencing what a PR is *not* about keeps an experiment shippable and the thread focused.

## How the author framed it (PR description excerpt)

> I am opening this PR for discussion about the general design we should start out with, as there are various options (that are not too hard to transition between each other, so we should totally just pick one and go with it and reiterate later)
> 
> r? @scottmcm and @joshtriplett 
> 
> project goal issue: https://github.com/rust-lang/rust-project-goals/issues/406
> tracking issue: https://github.com/rust-lang/rust/issues/146922
> 
> The design currently implemented by this PR is
> 
> * `TypeId::info` (method, usually used as `id.info()` returns a `Type` struct
> * the `Type` struct has fields that contain information about the type
> * the most notable field is `kind`, which is a non-exhaustive enum over all possible type kinds and their specific information. So it has a `Tuple(Tuple)` variant, where the only field is a `Tuple` struct type that contains more information (The list of type ids that make up the tuple).
> * To get nested type information (like the type of fields) you need to call `TypeId::info` again.
> * There is only one language intrinsic to go from `TypeId` to `Type`, and it does all the work
> 
> An alternative design could be
> 
> * Lots of small methods (each backed by an intrinsic) on `TypeId` that return all the individual information pieces (size, align, number of fields, number of variants, ...)
> * This is how C++ does it (see https://lemire.me/blog/2025/06/22/c26-will-include-compile-time-reflection-why-should-you-care/ and https://isocpp.org/files/papers/P2996R13.html#member-queries) 
> * Advantage: you only get the information you ask for, so it's probably cheaper if you get just one piece of information for lots of types (e.g. reimplementing size_of in terms of `TypeId::info` is li …​ *[truncated]*

## Highest-signal comments (ranked by reactions)

### @oli-obk — 18 reactions  
`🎉 18`  ·  [link](https://github.com/rust-lang/rust/pull/146923#issuecomment-3608482448)

> r? compiler
> 
> I got tentative approval to go ahead with the current impl. We may refactor it to a "many intrinsics" scheme later, but for an experiment I got a green light


### @RalfJung — 14 reactions  
`👍 14`  ·  [link](https://github.com/rust-lang/rust/pull/146923#issuecomment-3326855703)

> This is an MVP. Please do not flood this PR with all your wildest reflection dreams. Anything that suggests to extend the scope of this PR is off-topic.


### @BoxyUwU — 7 reactions  
`❤️ 2 · 🚀 5`  ·  [link](https://github.com/rust-lang/rust/pull/146923#issuecomment-3706851799)

> r=me if CI passes and you notice before i do :>


### @theemathas — 2 reactions  
`👍 2`  ·  [link](https://github.com/rust-lang/rust/pull/146923#issuecomment-3326224941)

> @addiesh It's been tried before, but has some unsolved design questions https://github.com/rust-lang/rust/pull/144363


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
