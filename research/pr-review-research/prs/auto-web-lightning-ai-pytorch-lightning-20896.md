# Lightning-AI/pytorch-lightning #20896 — feat: Default to `RichProgressBar` and `RichModelSummary` if `rich` is available

**[View PR on GitHub](https://github.com/Lightning-AI/pytorch-lightning/pull/20896)**

| | |
|---|---|
| **Author** | @littlebullGit |
| **Status** | Merged (August 12, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Borda
> pls add it as part of your PR :) *(requesting a changelog entry for the feature addition)*

### @bhimrazy
> inconsistent _RICH_AVAILABLE checks *(advocating to centralize version-checking logic across the codebase rather than duplicating it)*

### @Borda
> some concerns about the test *(withdrawing initial approval due to test implementation problems)*

### @andwaal-esmart
> this change broke our application...throwing exceptions with 'Only one live display may be active at once' *(post-merge: unintended consequence when Rich is already used in a user pipeline)*

### @Borda
> could ypu pls check the merge conflict, pls 🦩

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
