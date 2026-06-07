# pymc-devs/pymc #7380 — Implement unconstraining transform for LKJCorr

**[View PR on GitHub](https://github.com/pymc-devs/pymc/pull/7380)**

| | |
|---|---|
| **Author** | @johncant |
| **Status** | Merged (April 3, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jessegrabowski
> it seems like a bad idea to run a pytensor graph here. Is there any way to get the LKJCorr `n` parameter from `op` or `rv` without `eval`ing any pytensors?

### @ricardoV94
> BTW once this is merged we should still explore the new transform by that Stan dev, it should have better sampling properties IIRC

### @jessegrabowski
> Both `eta` and `n` can be symbolic...But small matrices are somewhat slower

### @ricardoV94
> I think we should be pragmatic here and allow n_steps to be constant like before.

### @ricardoV94
> no more slowdown from the scan as N grows, but still constant compile time

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
