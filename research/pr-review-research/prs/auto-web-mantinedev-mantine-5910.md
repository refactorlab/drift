# mantinedev/mantine #5910 — useLocalStorage and useSessionStorage missing dependencies

**[View PR on GitHub](https://github.com/mantinedev/mantine/pull/5910)**

| | |
|---|---|
| **Author** | @israelins85 |
| **Status** | Merged (subsequently reverted in a following patch) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rtivital
> What real problem do you have that this PR fixes?

### @gl3nn
> This PR broke all of our usages of it and thus can't update to 7.7.1. Would be nice in the future to show example code on what your issue was and why this would fix it.

### @icflorescu
> this also broke Mantine DataTable on Mantine 7.7.1...We're using the useLocalStorage hook to persist column resizing/ordering state, and it gets triggered infinitely with the same values

### @rtivital
> It would be reverted in next patch

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
