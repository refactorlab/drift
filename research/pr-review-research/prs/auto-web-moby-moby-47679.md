# moby/moby #47679 — c8d/push: Support `--platform` switch

**[View PR on GitHub](https://github.com/moby/moby/pull/47679)**

| | |
|---|---|
| **Author** | @vvoland |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cpuguy83
> I think the platform option needs to support something like `platform=default` so the client doesn't have to know the platform of the daemon.

### @cpuguy83
> Can we get an integration test for this?

### @thaJeztah
> Do we need to handle context cancel/timeout errors here?

### @thaJeztah
> I'll add a `docs/revisit` label to see if we can improve docs for this in a follow-up

### @vvoland
> I added the `local` and `remote` special values. `remote` is handled on the server (this PR), the `local` is handled in the CLI PR

### @thaJeztah
> The 'ignore platform on older API versions' commit could probably be squashed with the commit that added it to the router

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
