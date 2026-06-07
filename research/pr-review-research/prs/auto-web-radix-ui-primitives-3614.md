# radix-ui/primitives #3614 — Prevent render loop in `Popper`

**[View PR on GitHub](https://github.com/radix-ui/primitives/pull/3614)**

| | |
|---|---|
| **Author** | @chaance |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Note: This PR's conversation is dominated by the author's own explanation plus bot/changeset notifications and post-merge "is this released yet" inquiries; there is little back-and-forth peer-review prose. The single most substantive technical statement is:

### @chaance
> We _do_ want to check if the ref has changed on every render (as refs aren't reactive) but we need to do a defensive check that the ref values have actually changed.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
