# pgvector/pgvector #410 — Use LWLocks instead of SpinLocks

**[View PR on GitHub](https://github.com/pgvector/pgvector/pull/410)**

| | |
|---|---|
| **Author** | @hlinnaka |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hlinnaka
> The straightforward fix is to replace the per-element spin lock with an LWLock, too. An LWLock is almost as fast as a spinlock in the uncontended case, but not quite.

### @ankane
> Thanks @hlinnaka! Just tried converting the per-element locks and didn't find any issues.

### @ankane
> I'm not entirely sure I understand the purpose of the tranche for LWLocks (in Postgres). Is it mainly for debugging / stats?

### @hlinnaka
> Yes, it's purely for debugging and stats. One nice effect is that you see the lock name in `pg_stat_activity`

### @ankane
> Great, thanks for the explanation! It seems like we could probably use a single tranche for all locks.

### @hlinnaka
> Yeah, that works. It's nicer during debugging if you can easily see which lock is being contended.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
