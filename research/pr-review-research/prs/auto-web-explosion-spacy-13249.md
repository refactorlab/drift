# explosion/spaCy #13249 — `TextCatParametricAttention.v1`: set key transform dimensions

**[View PR on GitHub](https://github.com/explosion/spaCy/pull/13249)**

| | |
|---|---|
| **Author** | @danieldk |
| **Status** | Merged (February 2, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @svlandeg
> Would it be much work to make a sort of mockup `tok2vec` in the test suite for this purpose? I do think it's the sort of thing where we should have better tests because these things may come to bite us again in the future...

### @danieldk
> Agreed, I'll give it a try. Might reveal issues in the other implementations as well.

### @danieldk
> Added, this uncovered two more issues.

### @danieldk
> Tests break currently because of the issue that #13284 fixes.

### @danieldk
> Ready for another review round.

### @svlandeg
> Looks great!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
