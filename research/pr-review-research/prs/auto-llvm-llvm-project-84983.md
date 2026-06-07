# llvm/llvm-project #84983 — nonblocking/nonallocating attributes (was: nolock/noalloc)

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/84983)**

| | |
|---|---|
| **Author** | @dougsonos |
| **Status** | ✅ merged |
| **Opened** | 2024-03-12 |
| **Repo** | curated review-culture seed |
| **Diff** | +1850 / −11 across 24 files |
| **Engagement** | 64 conversation · 339 inline review comments |

## Top review comments (ranked by reactions)

### @Endilll — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/84983#issuecomment-1992612932)

> > This is an early PR to solicit comments on the overall approach and a number of outstanding questions.
> 
> You should advertise this elsewhere (e.g. in RFC thread), or remove the draft status so that reviewers can see this as something they should provide feedback on.

### @pinskia — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/84983#issuecomment-1992733763)

> Does it make sense to have some C testcases too? Likewise some testcases testing the __attribute__ style attribute?
> I would say more testcases the better really.

### @Sirraide — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/84983#issuecomment-1992739096)

> > * FunctionEffect/FunctionEffectSet need to be serialized as part of FunctionProtoType
> 
> That’s in `TypeProperties.td` from what I recall. You might be able to pack this into an integer or something similar perhaps.

### @pinskia — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/84983#issuecomment-1994978033)

> One question since the attribute is applied to types is there a way to get the nolock/noalloc from type?.
> e.g.
> ```
> template<class T> [[nolock(T)]] void f(T a) { a(); }
> ```
> Will the above work or is there no way to implement that currently?
> 
> Since you mention it is attached to the type, is it mangled then differently. e.g.:
> ```
> template<class T> [[nolock]] void f(T a) { a(); }
> [[nolock(true)]] void g(void);
> [[nolock(false)]] void h(void);
> void m()
> {
>   f(g);
>   f(h);
> }
> ```
> Does the above f calls to 2 different functions?
> Or is the nolock/noalloc dropped from function types for templates/auto usage?
> What about decltype (or the GNU extension __typeof__) usage is it dropped there too?

### @dougsonos — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/84983#issuecomment-1999930250)

> > I would maybe try going with that then for now (and maybe add a comment about that too); I’m not sure my function pointer example is really the same situation, but I remember finding an example that was analogous but for `noreturn` _somwhere_ in the test cases, but I don’t remember where.
> 
> Thanks. I just opened #85415 about the apparently reversed parameters to `IsFunctionConversion`

### @Sirraide — 1 reactions  
`👍 1`  ·  [link](https://github.com/llvm/llvm-project/pull/84983#issuecomment-2048239663)

> > An effect is more than its flags: its type is an identity, e.g. `nonblocking`, `nonallocating` and maybe soon `tcb("name")` (In the Discourse thread, there were concerns about overlap with TCB, and this design really wants to support an improved TCB that can analyze indirect calls). In the TCB case, identity is all that matters, and none of the flags will matter. Identity is also the straightforward way to implement the concept of `nonblocking` being a superset of `nonallocating` in a number of places that check.
> 
> I see yeah, that makes sense.
> 
> I have some more thoughts on this that I’d like to bring up: if the flags are really just implied by the identity of each effect, then is there a reason we can’t ‘just’ use attributes directly and store them as type sugar in the form of an `AttributedType` rather than in the `FunctionProtoType`? I recall discussing or seeing a discussion about this at some point, but it’s been a while and my memory isn’t the best when it comes to thing like these. 
> 
> Iirc one problem was that the `AttributedType` doesn’t store the actual attribute at the moment; however, we can look into changing that since this has caused problems in the past and refactoring it would make sense (I’ve also talked to Aaron about this before when we noticed problems w/ attributes on lambdas; a pr that fixes some of those problems is still waiting for a review: #85325). 
> 
> At the same time, one possible concern I do have is that while we try to preserve type sugar if possible, it’s also really easy to ‘accidentally’ drop it (e.g. `Ty->getAs<FunctionProtoType>()` and the … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
