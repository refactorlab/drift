# ray-project/ray #46911 — [core][experimental] Build an operation-based execution schedule for each actor to avoid deadlocks caused by NCCL operations

**[View PR on GitHub](https://github.com/ray-project/ray/pull/46911)**

| | |
|---|---|
| **Author** | @kevin85421 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stephanie-wang
> Sorry, I was using `bind_index` to mean the `local_idx` that you're using here...the execution schedule will favor scheduling tasks on actors that appear first in the dictionary, which may not be the same depending on what order the actors are inserted into the dictionary.

### @rkooo567
> can you run the microbenchmark? If we address the rest of @stephanie-wang's PR, I am okay with merging it without splitting to unblock @woshiyyya.

### @rkooo567
> we can handle it later. this just assumes reader/writer is synchronous, and I wondered if this should be passed as an input (so that we can support different implementation)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
