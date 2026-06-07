# typeorm/typeorm #11318 — feat(postgres): add support for PostgreSQL indices

**[View PR on GitHub](https://github.com/typeorm/typeorm/pull/11318)**

| | |
|---|---|
| **Author** | @freePixel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @OSA413
> Can you please add the columns for other types of indexes in this test?

### @OSA413
> I would also add a test to see what happens with adding an index to unsupported DB

### @alumni
> I'm actually not sure how to make `IndexMetadata.isSpatial = true` when the user defines `@Index({ type: 'gist' })`

### @coderabbitai
> The view-index branch doesn't compare index types so changes like `@Index({type: 'gin'})` on materialized views won't trigger drop/recreate

### @OSA413
> I think this should be extended to the other drivers that don't support index types.

### @alumni
> I don't like that now there are a lot of tests in one test file. If I will implement this for the SapDriver...I will likely extract the driver that I'm implementing into a new folder

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
