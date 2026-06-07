# open-policy-agent/opa #7458 — fix: don't panic on format due to unexpected comments

**[View PR on GitHub](https://github.com/open-policy-agent/opa/pull/7458)**

| | |
|---|---|
| **Author** | @sspaink |
| **Status** | Merged (April 15, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @anderseknert
> Looks like you'll need to rebase on top of main though, as the version used here doesn't include some later fixes.

### @johanfylling
> Are comments expected to be unordered, or could it be a problem that we're appending the backups to the tail here?

### @johanfylling
> What do you think about appending errors to `writer.errs` instead of panicking?

### @johanfylling
> Some more comments. Sorry for dragging this out. Thank you for bearing with me! :)

### @johanfylling
> Good job 👍 You've successfully passed through the ring of fire that is the formatter 😄

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
