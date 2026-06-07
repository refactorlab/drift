# clap-rs/clap #5621 — Support dynamic value of argument completion

**[View PR on GitHub](https://github.com/clap-rs/clap/pull/5621)**

| | |
|---|---|
| **Author** | @shannmu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @epage
> If the user wants panic prevention, they can provide it. I don't think we need to be doing it for them

### @epage
> Which parts are you concerned about? Do you have something in mind?

### @shannmu
> ArgExt has a restriction requiring the Debug trait, which means closures cannot be directly used...Therefore, I added a wrapper called ClosureCompleter that allows users to customize the debug info.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
