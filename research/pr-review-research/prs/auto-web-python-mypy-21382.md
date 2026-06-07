# python/mypy #21382 — Implement support for closed TypedDicts (PEP 728)

**[View PR on GitHub](https://github.com/python/mypy/pull/21382)**

| | |
|---|---|
| **Author** | @alicederyn |
| **Status** | Merged (by ilevkivskyi) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ilevkivskyi
> This may depend on who exactly will review this PR :-) Although this is a big PR, after quick look it seems quite non-controversial, so the review will be mostly double-checking all edge cases are handled correctly/consistently.

### @ilevkivskyi
> Using a flag instead of an extra `has_placeholder()` check(s) is a good idea, but same thing I mentioned before applies here, I would rather store this information on the `TypeInfo`.

### @ilevkivskyi
> Could you please wrap long string manually (using implicit concatenation) here and below? Unfortunately black doesn't do this automatically.

### @ilevkivskyi
> This behavior is worth documenting (with a short example). It is not obvious to a user which base takes precedence: first or last.

### @JukkaL
> This is a great feature, thanks for implementing it!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
