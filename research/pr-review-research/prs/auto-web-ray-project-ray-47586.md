# ray-project/ray #47586 — [core][compiled graphs] Overlap computation and communication

**[View PR on GitHub](https://github.com/ray-project/ray/pull/47586)**

| | |
|---|---|
| **Author** | @ruisearch42 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stephanie-wang
> Main comment is to try to reuse existing codepaths for executing tasks and reading/writing local args. I think the code will be much more robust this way... Seems possible to do if we wrap all inputs/outputs with a wrapper class like this, maybe we need to update the channel reading/writing

### @rkooo567
> I really think we need to unify the execution loop. The reason is the test space becomes much larger (we need to also make sure existing case works correctly when overlap is used).

### @stephanie-wang
> I prefer approach2 for the following reasons: (1) we don't leak details of overlapping communication etc outside of the DAGNodeOperation (2) we can call `.wait()` in only one place (better for testing/robustness) (3) simpler interfaces

### @rkooo567
> LGTM. One last request for unit tests

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
