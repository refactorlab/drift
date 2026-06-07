# moby/moby #49365 — Improve performance of daemon.Containers()

**[View PR on GitHub](https://github.com/moby/moby/pull/49365)**

| | |
|---|---|
| **Author** | @ctalledo |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @thaJeztah
> containers must be listed in descending order (last created container must appear first in the list). This order allows for various uses, and it's not unlikely that users depend on things like; View the last X containers

### @vvoland
> Hmm I think we should persist the existing order of the container list. Fortunately, I think we can do that quite easily.

### @thaJeztah
> I have some vague recollection of Windows time precision and nanoseconds; could it be that the timestamp is rounded, and we now end up with multiple containers created in the same second, so sorting becoming non-deterministic?

### @vvoland
> Overall LGTM, but left one nit. Also, please squash the commits ❤️

### @vvoland
> commits that are not separate changes on their own, or they don't make the changes clearer

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
