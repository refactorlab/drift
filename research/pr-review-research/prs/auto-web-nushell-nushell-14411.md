# nushell/nushell #14411 — Feature: PWD-per-drive to facilitate working on multiple drives at Windows

**[View PR on GitHub](https://github.com/nushell/nushell/pull/14411)**

| | |
|---|---|
| **Author** | @PegasusPlusUS |
| **Status** | Merged (December 2, 2024) — later reverted (December 16, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @devyn
> I feel like it's a little weird that this API does _not_ expand relative to what you passed in if it is a drive-relative path. Does Stack always have enough information to do PWD anyway?

### @sholderbach
> Just for understanding, which commands beyond `cd` do you think need changes?

### @kubouch
> Since the PR changes some of our core structures, it is important to stress-test it with various edge cases. I discovered one case when it does not work correctly with overlays: [C:\Users\kubouch\>] overlay use foo # changes dir to C:\Users [C:\Users\>] overlay hide foo # hides the overlay, changes back to the original directory [C:\Users\kubouch>] cd D: [D:\>] cd C: [C:\Users>] # should be C:\Users\kubouch, but it loads C:\Users from the hidden overlay

### @fdncred
> I think this looks pretty good now. I've asked other core-team members to take a look and provide feedback since the changes are pretty invasive. And of course, the CI needs to be green.

### @fdncred
> I'm not sure. There's some debate on whether we'll keep this PR landed. Let's see how it works for a bit.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
