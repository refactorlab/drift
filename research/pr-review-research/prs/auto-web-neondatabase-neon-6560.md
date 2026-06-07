# neondatabase/neon #6560 — Persist pg_stat information in pageserver

**[View PR on GitHub](https://github.com/neondatabase/neon/pull/6560)**

| | |
|---|---|
| **Author** | @knizhnik |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jcsp
> Can we enforce a size limit of this WAL write on the postgres side? (i.e. check `size` in wallog_file_descriptor, and if it exceeds a threshold, log a warning and don't write it).

### @jcsp
> it's important that we don't put the multi-megabyte stats value in the same structure, to avoid using unreasonable amounts of storage when logical replication is used.

### @skyzh
> I'm fairly uncertain about the pg_stat write pattern and whether the current compaction handles it well, so I'd prefer we test this in staging with large databases, and also make 'whether to persist/load pg_stat' as a pageserver-level flag.

### @skyzh
> I didn't see pg_stat-related files getting encoded in the aux file v2 mapping? What are the paths of the files produced by pg_stat, and probably we need to assign a prefix ID to that?

### @hlinnaka
> The test added here is going to be unstable

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
