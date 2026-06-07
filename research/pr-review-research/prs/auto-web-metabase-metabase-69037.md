# metabase/metabase #69037 — docs: transforms updates

**[View PR on GitHub](https://github.com/metabase/metabase/pull/69037)**

| | |
|---|---|
| **Author** | @alexyarosh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jeff-bruemmer
> Do we need 1? Is it implied?

(on whether a numbered list should start with step 1 for the permissions requirement)

### @jeff-bruemmer
> Maybe something about the fact that a transform isn't a table. It's akin to the query definition of a model, not the model as an entity that can be queried.

### @jeff-bruemmer
> Approving since this isn't going to master, but would be nice to address comments, particularly missing links, before merging to the feature branch.

### @alexyarosh
> Maybe but transforms are kind of weird compared to the rest of the product...you can _see_ transforms without transform permissions but you can't _make_ them.

### @jeff-bruemmer (suggested wording)
> By default, Metabase will process all the data in all input tables, drop the existing target table (if one exists), and create a new table with the processed data.

(editing for clarity on first-run incremental-transform behavior)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
