# clap-rs/clap #5539 — feat(clap_complete): Support flags with values `--flag bar` and `-f bar` in native completions

**[View PR on GitHub](https://github.com/clap-rs/clap/pull/5539)**

| | |
|---|---|
| **Author** | @shannmu |
| **Status** | Merged (July 23, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: The GitHub conversation page for this PR repeatedly failed to render its inline
> review-thread prose ("Uh oh! There was an error while loading. Please reload this page"),
> so only the reliably-loaded top-level discussion is captured verbatim below. Reviewers
> active on the thread included **@epage** (maintainer) and the author **@shannmu**.

### @epage
> While talked about this in the call, to not lose track of this [regarding -fbar and -f=bar support]. Please split that out into another branch for a later PR so we can focus on getting the current PR merged.

### @shannmu
> cases of -fbar and -f=bar have not been handled yet

(The deferred `-fbar` / `-f=bar` formats were subsequently handled in a separate PR, #5576.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
