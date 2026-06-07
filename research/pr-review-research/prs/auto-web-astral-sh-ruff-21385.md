# astral-sh/ruff #21385 — Keep lambda parameters on one line and parenthesize the body if it expands

**[View PR on GitHub](https://github.com/astral-sh/ruff/pull/21385)**

| | |
|---|---|
| **Author** | @ntBre |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @MichaReiser
> My only question is if we can improve call chain formatting. The extra set of parentheses around call chains often feels unnecessary.

### @MichaReiser
> Can you remind me again why we can't use this layout for call chains?

### @MichaReiser
> Can we give this variable a more descriptive name (also in FormatBody). Like dangling where?

### @ntBre
> (Explained the design rationale, noting that without special handling, call chains become unclear when followed by lambda arguments, citing the formatting issue from #8179 as precedent.)

**Note:** This PR's review threads were largely collapsed/resolved on the web view; the @ntBre rationale above is paraphrased from the visible summary rather than a clean verbatim block. The reviewer (MichaReiser) approved after ntBre refactored the code to use `trailing_header_comments` and `leading_body_comments` with clarifying documentation about comment placement and behavior.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
