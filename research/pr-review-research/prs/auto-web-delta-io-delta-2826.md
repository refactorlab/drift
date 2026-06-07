# delta-io/delta #2826 — [Kernel] Add kernel support for v2 checkpoints

**[View PR on GitHub](https://github.com/delta-io/delta/pull/2826)**

| | |
|---|---|
| **Author** | @chirag-s-db |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dhruvarya-db
> Table A only has one checkpoint which happens to be a compatibility V2 checkpoint...no sidecars will be read for this checkpoint and only the non-file actions will be read. This could result in the construction of a snapshot which looks legal but is missing references to many AddFiles.

### @dhruvarya-db
> With V2 Checkpoints, a checkpoint that appears to be a single_part checkpoint can actually be a V2 checkpoint. The only way to be sure about whether the checkpoint is V2 or classic is to read the checkpoint and look for the CheckpointManifest option action.

### @vkorukanti
> can we delay the loading of the sidecard files until we start reading?

### @vkorukanti
> can we insert bit more data...Set the parquet/json handler batch size to less than 100, so that we can [test] multiple batches from the ParquetHandler when reading checkpoint manifest or side car files. This exercises the iterator changes.

### @prakharjain09
> Can we also have a test case where both checkpoints - v2 and compat are present and assert that v2 is picked.

### @vkorukanti
> Setting configs like this works for Kernel? I thought we need to create a custom table client with Configuration containing these.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
