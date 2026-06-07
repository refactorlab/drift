# pgvector/pgvector #438 — Remove unnecessary PageIndexTupleOverwrite calls that caused UB

**[View PR on GitHub](https://github.com/pgvector/pgvector/pull/438)**

| | |
|---|---|
| **Author** | @hlinnaka |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ankane
> Thanks @hlinnaka! The `PageIndexTupleOverwrite` changes look good, but I'd prefer to keep the existing name for `ntup`.

### @ankane
> Can you back out the rename when you have a chance? Think this may be the last commit for 0.6.0. Edit: Could also do the update in-place and remove it ([branch](https://github.com/pgvector/pgvector/compare/hnsw-vacuum-ntup)), but not sure I like it as much, as feels like it provides less safety

### @ankane
> Think what I don't like about the branch is `HnswSetNeighborTuple` could write beyond `ntupSize` if there's ever a bug, which `PageIndexTupleOverwrite` prevents.

### @hlinnaka
> Seems safe to me. RepairGraphElement() operates on a copy of the page, thanks to GenericXLogRegisterBuffer(), so the changes won't hit the actual buffer until GenericXLogFinish() anyway.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
