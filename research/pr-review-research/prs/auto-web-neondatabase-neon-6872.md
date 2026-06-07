# neondatabase/neon #6872 — On-demand WAL download for walsender

**[View PR on GitHub](https://github.com/neondatabase/neon/pull/6872)**

| | |
|---|---|
| **Author** | @save-buffer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @petuhovskiy
> FYI there are failpoints: [link] I never used them, but they look similar to what you are trying to do with REPLICATION_PAUSED

### @arssher
> Yes. 1) If subscriber lags a lot it might take a long time to download everything, and currently it blocks writing because walproposer does this 2) compute can run out of disk space.

### @arssher
> Direction is right, but there are some places to fix. I also pgindent should be run (see pgindent target in neon extension makefile).

### @arssher
> I made one more pass, making fix to mineLastElectedTerm and doing some cleanup... It LGTM now. But let's let it soak on staging during this week.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
