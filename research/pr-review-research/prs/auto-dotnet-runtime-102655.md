# dotnet/runtime #102655 — NonBacktracking Regex optimizations

**[View PR on GitHub](https://github.com/dotnet/runtime/pull/102655)**

| | |
|---|---|
| **Author** | @ieviev |
| **Status** | ✅ merged |
| **Opened** | 2024-05-24 |
| **Repo** | curated review-culture seed |
| **Diff** | +994 / −257 across 18 files |
| **Engagement** | 69 conversation · 198 inline review comments |

## Top review comments (ranked by reactions)

### @veanes — 2 reactions  
`👍 2`  ·  [link](https://github.com/dotnet/runtime/pull/102655#issuecomment-2197673892)

> The current SampleMatches generator, that I just looked at, (in System.Text.RegularExpressions.Symbolic.SymbolicRegexMatcher) does actually not use the algorithm based on transition regexes (that are lazy unwindings of a regex). Use of transition regexes here would be another algorithm for input generation that is currently not implemented (neither is the implementation for transition regex itself). The current sample input generator uses NFA state handler that iterates over minterms and essentially searches randomly for matching inputs. A better and more reliable algorithm would need transition regexes, that would then also be used for generating rejected inputs by using complement. (My memory is a bit rusty at this point how all the dots are connected.)

### @ieviev — 1 reactions  
`👍 1`  ·  [link](https://github.com/dotnet/runtime/pull/102655#issuecomment-2169843118)

> > In our previous conversations, you mentioned you thought inner vectorization would be possible, where we could vectorize within a match rather than just finding the next starting place. I don't see that in this PR. Is that possible? Seems like that'd be an opportunity for some significant wins.
> 
> Yes, this is possible. Any pattern that contains .* could be a lot faster with longer matches. It'd be best to start with inner vectorization without anchors. The presence of anchors makes it more complicated and expensive but i still think it's possible with anchors as well when followed with an anchor context lookup, also it needs a bit of testing to see where the line between match time speedup and unwanted compile/construction-time overhead is.
> 
> > I understand from your comments that these change brought significant wins on some patterns, in particular those involving non-ASCII, which is great. I'm a bit concerned though that when running this on our own perf test suite, I'm seeing regressions in various places. You can find the tests in https://github.com/dotnet/performance/tree/main/src/benchmarks/micro/libraries/System.Text.RegularExpressions. Some of the more concerning ones were \p{Sm} and .{2,4}(Tom, which regressed throughput by ~50%, and Holmes.{0,25}(...).{0,25}Holmes..., which regressed throughput by ~25%. Thoughts?
> 
> I'll definitely profile these as well. There is some overhead from the way edge cases are currently handled. \p{Sm} in particular could be made to skip the reversal part entirely along with other fixed length patterns. I'll follow up about this once i've … *[truncated]*

### @ieviev — 1 reactions  
`👍 1`  ·  [link](https://github.com/dotnet/runtime/pull/102655#issuecomment-2194473046)

> Ok, great! I'll finish the remaining parts in the coming days and let you know if there's any questions.

### @veanes — 1 reactions  
`👍 1`  ·  [link](https://github.com/dotnet/runtime/pull/102655#issuecomment-2197574459)

> The input generation was, if I recall correctly, using transition regexes (symbolic derivatives as nested if-then-else terms). At some point we had that code also checked in the runtimelab and it was used for some input generation when we were experimenting with extended features, but it was not used later on, so we omitted this code in the end. It could be used for random walks essentially to produce accepting and nonaccepting inputs up to a certain length.

### @stephentoub — 1 reactions  
`👍 1`  ·  [link](https://github.com/dotnet/runtime/pull/102655#issuecomment-2197619245)

> > to what extent does non backtracking offer safety guarantees beyond regular engine with a timeout?
> 
> If execution consuming resources up to the specified timeout meets your needs, then it doesn't offer safety guarantees beyond that. Rather, for certain kinds of patterns, it can provide both the safety and efficiency, without needing to rely on a timeout as a backstop.

### @veanes — 1 reactions  
`🚀 1`  ·  [link](https://github.com/dotnet/runtime/pull/102655#issuecomment-2197803457)

> I intend to work with Ian in the coming days to help him resolve the remaining outstanding comments in this PR asap.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
