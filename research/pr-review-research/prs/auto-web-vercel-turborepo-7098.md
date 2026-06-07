# vercel/turborepo #7098 — Examples tests revamp.

**[View PR on GitHub](https://github.com/vercel/turborepo/pull/7098)**

| | |
|---|---|
| **Author** | @anthonyshew |
| **Status** | Merged (January 31, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mehulkar
> Mostly there, there's some script cleanup to do. I'd also install `shellcheck` as a VS Code extension if you don't have it already (it's a linter essentially), I've found that to be a pretty useful learning tool!

### @mehulkar
> In case you didn't already know, there's a handy way of making a tmp directory (that you never need to touch again, the OS will just clean it up on restart) — `mktemp -d`

### @anthonyshew
> We're going to work in a temporary directory for better test isolation. Ya know, like I actually know what I'm doing finally.

### @mehulkar
> Ran it locally and the tests passed, nice job! I don't love that it leaves a `examples-tests-tmp/` laying around my repo which is largely a duplicate of `examples/`, but I guess that's ok and/or we can take it another pass.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
