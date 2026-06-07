# llvm/llvm-project #84983 — nonblocking/nonallocating attributes (was: nolock/noalloc)

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/84983)**

| | |
|---|---|
| **Author** | @dougsonos |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Sirraide
> making it extensible doesn't sound like a bad idea on paper, but adding any effects would likely require significant modifications to other parts of the compiler as well

### @Sirraide
> that bug defeats `h`'s wish to not have `nolock` inferred on it, so the analysis decides

### @AaronBallman
> The only thing I think is missing is a release note in `clang/docs/ReleaseNotes.rst` so users know about the new functionality

### @nikic
> There is a regression of about 0.25% for unoptimized builds. It also regresses time to build clang by 0.5%

### @Sirraide
> move the checks for whether a function even has effects attached to it as far up as possible and try and also optimise that check

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
