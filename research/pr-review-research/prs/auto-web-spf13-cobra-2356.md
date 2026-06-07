# spf13/cobra #2356 — fix: prevent completions from mutating os.Args via append side effect

**[View PR on GitHub](https://github.com/spf13/cobra/pull/2356)**

| | |
|---|---|
| **Author** | @veeceey |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @marckhouzam
> Would it be doable to have a test that actually checks that os.Args is unchanged (but wrongly changed without the fix)?

### @marckhouzam
> (Design concern) Requested moving the copy operation upfront rather than using three-index slice expressions at append sites, to prevent any future mutations from occurring.

### @alexandear
> (Suggestion) Recommended using `make`+`copy` approach as cleaner than the three-index slice expression, eliminating downstream append risks entirely.

### @ccoVeille
> (Approval) Approved the final implementation after design discussions were resolved through iterative refinement of the copying strategy.

_Note: this PR's review threads were partly summarized rather than fully verbatim where the conversation page did not render the exact inline-comment prose within the fetch budget._

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
