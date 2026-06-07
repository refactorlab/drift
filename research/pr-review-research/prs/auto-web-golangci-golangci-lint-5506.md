# golangci/golangci-lint #5506 — feat: migration command

**[View PR on GitHub](https://github.com/golangci/golangci-lint/pull/5506)**

| | |
|---|---|
| **Author** | @ldez |
| **Status** | Merged (Mar 10, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bombsimon
> Nice!! I've yet to review the individual migrations but everything else looks great! I don't think there's much to add for the rest of the code given all the tests but I saw you did a great job on documenting all permutations of enabled and disabled linters that I plan to give an extra read.

### @SuperSandro2000
> Did you think about using the new omitzero tag from go 1.24?

### @ldez
> Yes, but: 1. We need to compile with go1.23 2. it doesn't solve default non-zero value (`true`, `8`, etc.) 3. my implementation is simple, no plumbing

### @alexandear
> Awesome work. Left some comments. Will take a look again later today, still need to review few files.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
