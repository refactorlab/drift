# astral-sh/ruff #17851 — Implement template strings

**[View PR on GitHub](https://github.com/astral-sh/ruff/pull/17851)**

| | |
|---|---|
| **Author** | @dylwil3 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MichaReiser
> Overall, my impression is that we went too far with copy pasting. We should consider more carefully where it is important to have different representations for t- and f-strings and where it is fine to share the same structs or parametrizing functions if they're identical except for e.g. some token kinds.

### @dhruvmanila
> Looking at Micha's review, I'll wait for the follow-up changes to de-duplicate and then review but I agree that we should parameterize the methods and do minimal changes where f-strings and t-strings are different.

### @MichaReiser
> Awesome. Thank you for addressing all my feedback. My only concern left is that we use different terminology for the same thing in different places. Sometimes we use FT, sometimes we use InterpolatedString. We should make sure to only use one of the two.

### @dylwil3
> My main motivation for keeping so many things separate (e.g. the AST nodes) was to mimic to some extent what is being done in the CPython implementation...if changes are introduced such that the behavior of t-strings and f-strings diverges further, this would be easier to maintain.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
