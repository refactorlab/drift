# pymc-devs/pymc #8047 — SMC Multiprocessing and Progress Bar Refactor

**[View PR on GitHub](https://github.com/pymc-devs/pymc/pull/8047)**

| | |
|---|---|
| **Author** | @jessegrabowski |
| **Status** | Merged (Feb 12, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ricardoV94
> So there's an edge case with the pickle function -> send to process approach. If the pickled functions have random number generators these need to de changed so as to have independent streams.

### @ricardoV94
> This change is too large and technical to be confident we didn't break anything from code review and CI passing alone. So let's keep an eye after we merge...

### @zaxtax
> Multiprocess code is tricky. We should have unit test coverage for this.

### @ricardoV94
> Perhaps initialize only when the task / bar advances for the first time. So that sequential sampling is not measuring speed relative to the start of the first chain

### @jessegrabowski
> Could we just make the rng an explicit input to the function we pickle up and send out, to avoid the copy?

### @ricardoV94
> Not without much more changes in the codebase

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
