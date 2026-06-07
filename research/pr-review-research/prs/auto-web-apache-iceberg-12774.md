# apache/iceberg #12774 — Core, Data: File Format API interfaces

**[View PR on GitHub](https://github.com/apache/iceberg/pull/12774)**

| | |
|---|---|
| **Author** | @pvary |
| **Status** | Merged (Feb 6, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @liurenjie1024
> Thanks @pvary for this pr, left some comments, genearlly looks great!

### @stevenzwu
> left some initial comments on the interfaces. will still need to take a look at the other bigger PR to understand more on the work as a whole.

### @RussellSpitzer
> Could you take a look from a comet prospective? I know you have some custom code that would be using this as well

### @rdblue
> The engine schema must be aligned with the Iceberg schema, but may include representation details that Iceberg considers equivalent.

### @rdblue
> I think a simple example (`tinyint` / `int`) would help as well.

### @rdblue
> I don't think that there are any remaining blockers so I'll go ahead and merge it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
