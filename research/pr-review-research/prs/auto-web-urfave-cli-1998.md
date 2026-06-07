# urfave/cli #1998 — Improve the command for printing completion scripts

**[View PR on GitHub](https://github.com/urfave/cli/pull/1998)**

| | |
|---|---|
| **Author** | @bartekpacia |
| **Status** | Merged (Nov 24, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dearchap
> I dont see the value of this example. Its not really doing anything.

### @abitrolly
> For the sake of bikeshedding `examples/commands.go` may be a better name. I would suggest to submit it in a separate PR.

### @abitrolly
> `examples_test.go` is not discoverable, and also they do not work if copy-pasted.

### @dearchap
> I've worked so much over the last month to get the code coverage from 80 something percent to 98.4% and now it decreases again.

### @abitrolly
> Except, maybe to squash the history, or rebase to a minimal set of commits to avoid stumbling into reverts.

### @dearchap
> Please try to add additional tests or remove err in the lookup.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
