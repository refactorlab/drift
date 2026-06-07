# dask/dask #11568 — Blockwise uses `Task` class

**[View PR on GitHub](https://github.com/dask/dask/pull/11568)**

| | |
|---|---|
| **Author** | @fjetter |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hendrikmakait
> Having the dosctring around would be helpful to future me.

### @fjetter
> The substitution logic could be factored out into a separate PR on request. It's not used anywhere else so I chose to keep in in here but if it helps with review, I'll break it out

### @fjetter
> picking is much faster because we're now deduplicating the subgraphs/tasks properly again...saves us a bit more than a minute

### @martindurant
> Can we please ask for a migration guide, and how to make our code backward compatible?

### @fjetter
> blockwise isn't used that widely as a user facing API so I expected the splash zone to be small to moderate

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
