# wandb/wandb #10136 — chore(artifacts): compute hash of multipart in parallel

**[View PR on GitHub](https://github.com/wandb/wandb/pull/10136)**

| | |
|---|---|
| **Author** | @pingleiwandb |
| **Status** | Merged (Aug 1, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tonyyli-wandb
> the numWorkers should probably be calculated based on GOMAXPROCS or number of CPUs available instead of hardcoding it to a specific number

### @kptkin
> We should probably add some error handling for the context cancellation and ensure partial results are handled correctly if one goroutine fails

### @timoffex
> Why not use a semaphore or worker pool pattern instead of spawning all goroutines at once to better control memory usage during hashing?

### @kptkin
> The logging output should include the actual hash computation time separate from I/O overhead for better performance debugging

### @timoffex
> Consider documenting the backward compatibility guarantees since multipart hash ordering matters for S3 upload integrity

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
