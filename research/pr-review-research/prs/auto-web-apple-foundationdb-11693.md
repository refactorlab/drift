# apple/foundationdb #11693 — Database Per-Range Lock

**[View PR on GitHub](https://github.com/apple/foundationdb/pull/11693)**

| | |
|---|---|
| **Author** | @kakaiu |
| **Status** | Merged (Oct 23, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sbodagala
> Would you please provide the motivation for doing this work? What problem(s)/use case(s) we are trying to solve?

### @sbodagala
> Have we thought about simplifying things by probably adding a restriction like multiple bulk loads are not allowed for a given range at a time, and thereby the identity concept is not needed?

### @sbodagala
> The intention is that the user holding a read lock can/would do a bulk load to that range, right? That means all users holding read locks on a range can do bulk loads to that range (and they won't conflict)?

### @kakaiu
> I would like to separate RangeLock to BulkLoad because RangeLock has broader usage. Sometimes, we just want to lock a range.

### @kakaiu
> The motivation for introducing the identity concept is that RangeLock as a utility can be used for different reasons at the same time.

### @kakaiu
> In the bulkLoad scenario, the lockOwner is the bulkLoad mechanism. When a range is locked by the bulkLoad, other users/applications/features cannot write to the range.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
