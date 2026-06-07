# lampepfl/dotty #21693 — Implement SIP-61 `@unroll` annotation

**[View PR on GitHub](https://github.com/lampepfl/dotty/pull/21693)**

| | |
|---|---|
| **Author** | @bishabosha |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lihaoyi
> if code can override an `@unroll`ed method, it can result in different callsites running different logic depending on what version of the `@unroll`ed API they were compiled against

### @lihaoyi
> The original compiler plugin didn't have support for `trait` parameter lists. Would that be easy to add?

### @sjrd
> if `Invisible` does not have the semantics we want, we can introduce a new TASTy flag with the semantics we want

### @lihaoyi
> We ended up removing the `abstract def` support from the SIP since we weren't confident in the semantics, so let's disable it in the implementation as well

### @bishabosha
> there isn't a way to support trait constructor parameters that isn't a rewrite that a user could do manually

### @sjrd
> Is the git history relevant? Or should it all be squashed to help future `git blame`s?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
