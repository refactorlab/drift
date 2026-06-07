# VictoriaMetrics/VictoriaMetrics #8134 — lib/storage: implement partition index

**[View PR on GitHub](https://github.com/VictoriaMetrics/VictoriaMetrics/pull/8134)**

| | |
|---|---|
| **Author** | @rtm0 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: This was the highest-comment PR in the repo (296 comments), but nearly all review threads on the public conversation page were collapsed/resolved ("Show resolved / Hide resolved") and their individual human comment bodies did not render via web fetch. The maintainer **@valyala** approved with "LGTM"; additional reviews came from **@f41gh7** and a Copilot bot. Author **@rtm0** posted iterative self-review notes addressing remarks around metadata ID caching and per-day metric ID updates.
>
> Design context captured from the PR description and discussion: the change replaces the monolithic indexDB with per-partition indexDBs to reduce disk usage — each partition gets its own indexDB created/deleted with the partition so index cleanup follows the data lifecycle. It is forward-compatible but not backward-compatible: existing deployments keep their global indexDB in read-only mode (queried concurrently) and delete it once it falls outside the retention period.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
