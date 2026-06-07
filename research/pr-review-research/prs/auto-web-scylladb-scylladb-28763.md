# scylladb/scylladb #28763 — Tablet-aware restore

**[View PR on GitHub](https://github.com/scylladb/scylladb/pull/28763)**

| | |
|---|---|
| **Author** | @xemul |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

The public conversation page renders review activity (resolved/outdated markers and file references) but does not expose the verbatim bodies of most inline review comments without authentication. No substantive prose review comments could be quoted verbatim from the fetched HTML.

Reviewers who engaged substantively (across files such as `db/system_distributed_keyspace.cc`, `docs/dev/object_storage.md`, `docs/dev/snapshot_sstables.md`, `service/topology_coordinator.cc`, `sstables_tablet_aware_loader.cc`, `sstables_loader.cc`, and `service/storage_service.cc`):

### @bhalevy
> (Multiple inline review concerns raised; verbatim text not rendered on the public conversation page.)

### @mitso23
> (Extensive inline review feedback; verbatim text not rendered on the public conversation page.)

The PR description itself notes design limitations: single-DC cluster support only, a non-abortable design, lack of progress tracking, and sub-optimal re-execution behavior.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
