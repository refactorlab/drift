# pallets/flask #5647 — fix type hint for `cli_runner.invoke`

**[View PR on GitHub](https://github.com/pallets/flask/pull/5647)**

| | |
|---|---|
| **Author** | @kurtatter |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidism
> It looks like you committed as a different user than you posted as. Do you want to fix that?

### @davidism
> You can do the following: $ git commit --amend --author 'Your Name <your email>' --no-edit $ git push -f

### @davidism
> Looks like that didn't work. Maybe you need to fix your git config locally and try again?

*Note: This PR (changing the return type hint of `testing.invoke()` from `t.Any` to `Result`, per issue #5645) had minimal design discussion. The substantive maintainer feedback was procedural — resolving a git author/identity mismatch — and is captured verbatim above.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
