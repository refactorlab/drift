# llvm/llvm-project #113510 — [RFC] Initial implementation of P2719

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/113510)**

| | |
|---|---|
| **Author** | @ojhunt |
| **Status** | ✅ merged |
| **Opened** | 2024-10-24 |
| **Repo** | curated review-culture seed |
| **Diff** | +3629 / −458 across 50 files |
| **Engagement** | 35 conversation · 373 inline review comments |

## Top review comments (ranked by reactions)

### @zmodem — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/113510#issuecomment-2494078935)

> > Could anyone with a windows machine see if you can work out what is happening with the windows test failure? I don't understand why the tests are failing on the windows bot as it seems like it should simply fail everything (e.g. windows driver is going wrong) or it should work
> 
> It looks like the latest commit did pass on Windows, so this may be redundant but it also passes locally on my Windows machine.

### @erichkeane — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/113510#issuecomment-2706990290)

> > I'm getting nitpicky, but there are still unaddressed comments.
> > 
> > In the interest of landing that soon, we should figure out the following:
> > 
> > Do we want to keep the document, knowing this is likely to be adopted as a standard feature? I would rather just link to the paper.
> > 
> >     * We need a changelog entry
> > 
> >     * Do we want to keep the compiler flags knowing this is likely to be adopted as a language feature? I would prefer checking for c++26 + extension warnings in older language modes
> > 
> >     * Do we actually want to set the feature test macro now?
> > 
> >     * Why do we have both a feature test macro and `has_cxx_feature` ?
> > 
> > 
> > I do think landing the PR ahead of Sofia makes perfect sense. This is a large body of work that Apple is keen on seeing upstreamed. It's a great security feature, and the paper is past EWG with strong support.
> > 
> > The next standard meetings will be well ahead of the clang 21 feature freeze, so we can reassess then if WG21... surprises us.
> > 
> > @erichkeane @AaronBallman
> 
> My opinion is that we implement it as-if it was accepted at plenary.  This isn't controversial as far as I can tell, and the core review doesn't seem to have any deal-breakers as far as I can tell.  
> 
> So I agree with your bullet 2.  I think we SHOULD set the feature-test-macro, and otherwise just treat this like it was accepted in plenary.

### @ojhunt — 1 reactions  
`👀 1`  ·  [link](https://github.com/llvm/llvm-project/pull/113510#issuecomment-2825910076)

> @alexfh yeah I think I found the issue, would you mind trying https://github.com/llvm/llvm-project/pull/137102 ? (need to work on tests but wanted you to be able to test quickly - I'm currently waiting on a fresh build alas so the PR is currently done blind)

### @cor3ntin — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/113510#issuecomment-2434616599)

> Thanks for working on this.
> 
> FYI most reviewers at the LLVM conference, do not expect a lot of feedback this week
> We will need to call consensus on https://discourse.llvm.org/t/rfc-typed-allocator-support/79720 first in any case

### @ojhunt — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/113510#issuecomment-2436348425)

> @cor3ntin oh yeah, I know, I'm also there :D

### @ojhunt — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/113510#issuecomment-2456369560)

> Ok, so I've gone through all my GitHub settings, and am hoping for a comment or something, to see if GH will actually ping me this time :D


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
