# ibis-project/ibis #9096 — feat(api): move from .case() to .cases()

**[View PR on GitHub](https://github.com/ibis-project/ibis/pull/9096)**

| | |
|---|---|
| **Author** | @NickCrews |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cpcloud
> I am very opposed to this function. Instead of massaging this to be something close to maintainable, why not just wait until 10.0?

### @cpcloud
> There also seem to be a few scope increases (e.g., the cast insertion) that should really be avoided.

### @NickCrews
> (Proposed separating the breaking changes: deprecate `ibis.case()` and `Value.case()` in 10.0 with removal in 11.0, while making `Value.cases()` a hard break with no upgrade path — a trade-off discussion balancing user migration needs against code complexity.)

### @cpcloud
> Please do not merge anything that has CI failures... that definitely is a hard requirement for merging a PR.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
