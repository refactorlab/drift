# llvm/llvm-project #92418 — [LoopVectorizer] Add support for partial reductions

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/92418)**

| | |
|---|---|
| **Author** | @NickGuy-Arm |
| **Status** | ✅ merged |
| **Opened** | 2024-05-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +3812 / −31 across 16 files |
| **Engagement** | 27 conversation · 371 inline review comments |

## Top review comments (ranked by reactions)

### @NickGuy-Arm — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/92418#issuecomment-2115630979)

> This patch only implements the pattern recognition and production of the partial reduction intrinsic, it does not yet lower the intrinsic to valid IR/Asm, those will be coming later.
> I'm also away for the next week, so will address comments when I return

### @huntergr-arm — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/92418#issuecomment-2117896131)

> > If I'm understanding correctly, a "partial reduction" is just a slightly different way of generating code for a reduction? Basically, instead of performing the reduction using a number of lanes equal to the vector factor, you combine some of the lanes each iteration. Usually, this wouldn't really be profitable unless you have a register pressure problem. But in very specific cases, you can use specialized instructions that do horizontal sums, in which case it's extremely profitable. (This is why the testcase is called "partial-reduced-sdot.ll", I assume.)
> > 
> > It seems a bit weird to me to introduce a new intrinsic that, in the general case, isn't actually a natively supported operation on any target.
> 
> Hi,
> 
> Yes, it's effectively a way of representing a reduction that allows us to vectorize with a wider VF than we normally would, since the IR extends the elements loaded from memory. For the AArch64 instructions we're targeting (sdot, udot, etc.) the extension is part of the instruction; e.g. sdot of two <vscale x 16 x i8> inputs results in a <vscale x 4 x i32> output. While this may be interesting for some actual dot products in SLP vectorization, for this patch we're just interesting in increasing our VF where possible.
> 
> I posted PRs last year for a different approach which only widened the VF in LoopVec and pattern-matched to aarch64-specific dot product instructions in a target-specific pass. There was no real interest in those PRs and I was asked to consider a different approach. Nick has now implemented the suggested approach.
> 
> (obsolete LoopVec PR to widen VF: https: … *[truncated]*

### @paulwalker-arm — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/92418#issuecomment-2127323173)

> > It seems a bit weird to me to introduce a new intrinsic that, in the general case, isn't actually a natively supported operation on any target.
> 
> I see it more about giving LLVM IR a more powerful representation of reductions than we have today. The current representation effectively demands a specific order in which elements are reduced that is hard to break down (as can be seen with Graham's original patches).
> 
> By dissociating input and output types we can make VF decisions that better reflect the input data whilst at the same time express there is no defined ordering for how the inputs are reduced.  For AArch64 specifically I'm hoping this goes beyond just dot instructions and allow us to make better use of paired and top-bottom instructions.  I'd expect targets that have no special instructions to simply select the output type to match the input and then code generate a standard binop as they do today.
> 
> Perhaps there's an argument the new intrinsics can replace the current vector_reduce_ ones which are another special case being they have a single element result.

### @NickGuy-Arm — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/92418#issuecomment-2149964378)

> I've separated out the recent work into logical chunks that, while conceptually could be separate PRs, are still somewhat inter-dependent and are untested in isolation. I could separate them out to different PRs if necessary, however I feel there is value in not fragmenting any discussions.

### @paulwalker-arm — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/92418#issuecomment-2150049473)

> > I could separate them out to different PRs if necessary, however I feel there is value in not fragmenting any discussions.
> 
> As a minimum the intrinsic and its code generation should be broken out into its own PR.  There's never a good reason for code generation and IR optimisation work to be combined because the intrinsic should be able to stand on its own merits.

### @NickGuy-Arm — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/92418#issuecomment-2150517761)

> I've pulled the intrinsic & it's codegen out to https://github.com/llvm/llvm-project/pull/94499, I'll remove the relevant changes from this PR (once I figure out how to emulate PR dependencies)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
