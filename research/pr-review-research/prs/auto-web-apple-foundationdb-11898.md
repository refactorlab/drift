# apple/foundationdb #11898 — Bulkload Engine Support General Storage Engine and Fix BulkLoad Bugs

**[View PR on GitHub](https://github.com/apple/foundationdb/pull/11898)**

| | |
|---|---|
| **Author** | @kakaiu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @saintstack
> What is the move id? ... I could take a guess...Every data move gets a unique id?

### @saintstack
> We are removing this flag because we will auto-detect whether to do physical shard move or not? Or is it that we'll restore physical shard move under a knob at a later date?

### @xy-54321
> Is this a valid case? IIUC, the data will only be available if other storage server finishes loading the shard first. Can anyone read the range this is actively being loaded? Does DD/CC lock the range? When bulk load happens, does it happen on all the replicas at the same time?

### @jzhou77
> Maybe add a new error type and throw it here

### @jzhou77
> Add a TODO: this is potentially a slow task, cannot be called on critical path

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
