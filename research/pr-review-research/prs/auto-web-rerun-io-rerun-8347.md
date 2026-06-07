# rerun-io/rerun #8347 — Encode `LogMsg` using protobuf

**[View PR on GitHub](https://github.com/rerun-io/rerun/pull/8347)**

| | |
|---|---|
| **Author** | @jprochazk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zehiko
> thanks for untangling these dependency issues! generally looks ok to me, few comments and a question about more clear re-use of common arrow seriailzation logic to make `re_log_encoding` crate clearer.

### @emilk
> Wait, what the hack is this @teh-cmc ??

(questioning an unintuitive pattern-matching approach in the protobuf conversion code where multiple different names map to the same TimelineKind)

### @emilk
> Tip: add a `// TODO` suffix on code you plan to remove (the linter will stop you from merging it). Or use `dbg!(options);`

### @zehiko
(Multiple inline comments requesting clarification and consistency across conversion implementations in `re_log_encoding`, `re_log_types`, and related modules regarding Arrow serialization reuse.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
