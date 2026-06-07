# run-llama/llama_index #17006 — [Feature] Checkpointing with Workflows

**[View PR on GitHub](https://github.com/run-llama/llama_index/pull/17006)**

| | |
|---|---|
| **Author** | @nerdai |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @masci
> If we want mostly to run from a checkpoint, then we can (and probably should) just do this in `Workflow` itself

### @nerdai
> We need to keep track of steps that are in progress at the creation time of a checkpoint. Otherwise...we will lose these events if we attempt to load from a checkpoint.

### @masci
> LGTM overall, left a couple of comments!

### @logan-markewich
> _(Multiple review rounds on the checkpointing notebook example, focused on ensuring users understand practical usage patterns for loading from checkpoints and re-running workflows. Exact prose for these inline review comments was not fully retrievable from the web conversation page.)_

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
