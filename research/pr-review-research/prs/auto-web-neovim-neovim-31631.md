# neovim/neovim #31631 — feat(treesitter): async parsing

**[View PR on GitHub](https://github.com/neovim/neovim/pull/31631)**

| | |
|---|---|
| **Author** | @ribru17 |
| **Status** | Merged (January 13, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @clason
> I think (at least for now) we need to distinguish between 'background' processing -- such as highlighting -- and 'on demand' processing -- such as textobjects. Async is absolutely necessary for the former but can be deferred for the latter.

### @justinmk
> What is the worst case scenario? If we want to make it safe, we could proxy the self methods to force waiting on the parse result.

### @ribru17
> Worst case scenario, we call this and then call a function which expects parsing to be complete (e.g. `get_node()`) but it is not yet complete...that was basically what it was before.

### @vanaigr
> `ts_subtree_balance()` called here exceeds the time limit. From the arguments, it looks like it doesn't have access to the timeout, so I assume it doesn't check it.

### @lewis6991
> Follow-up would be to permanently disable parsing from the highlighter for any buffer that exceeds the timeout.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
