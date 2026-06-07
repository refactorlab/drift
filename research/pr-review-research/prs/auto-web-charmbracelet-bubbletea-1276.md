# charmbracelet/bubbletea #1276 — Maintain exec output

**[View PR on GitHub](https://github.com/charmbracelet/bubbletea/pull/1276)**

| | |
|---|---|
| **Author** | @raphaelvigee |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @meowgorithm
> Do you have any sample code to help illustrate the issue? Providing it will help us expedite this one.

### @aymanbagabas
> Patch looks good to me @raphaelvigee. Could you add a test case for it?

### @aymanbagabas
> We can add a simple test in `exec_test.go` to check if `p.renderer.resetLinesRendered` is called.

### @aymanbagabas
> @raphaelvigee Question: do you know if this happens with v2?

### @aymanbagabas
> The lint tests were failing, which we will address internally. Thank you, @raphaelvigee!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
