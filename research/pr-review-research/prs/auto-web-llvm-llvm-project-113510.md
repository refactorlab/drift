# llvm/llvm-project #113510 — [RFC] Initial implementation of P2719

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/113510)**

| | |
|---|---|
| **Author** | @ojhunt |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @AaronBallman
> The changes should come with release notes in clang/docs/ReleaseNotes.rst so users know about the new functionality. Unless this is slated for inclusion in C++26, it should probably also come with user-facing documentation in the language extensions file.

### @AaronBallman
> Hmmmm it's a bit weird that we're changing MSVC compat mode when I don't think MSVC implements this functionality at all. I'm not opposed, but do we want to support this in MSVC compat mode?

### @erichkeane
> I cant find my comment, but I see the args structure isn't actually stored anywhere except as params, so feel free to disregard that comment.

### @cor3ntin
> I think the PR is in pretty good shape and it's becoming counter productive to nitpick this giant piece of work...Looks Good To Me. Ship it.

### @alexfh
> We have tracked two more issues to this commit. Both only manifest when using Clang header modules, which likely means that AST serialization is somehow incorrect after this patch.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
