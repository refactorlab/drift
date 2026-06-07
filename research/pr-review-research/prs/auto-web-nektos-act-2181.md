# nektos/act #2181 — fix: Rootless error concerning `/var/run/docker.sock`

**[View PR on GitHub](https://github.com/nektos/act/pull/2181)**

| | |
|---|---|
| **Author** | @AndesKrrrrrrrrrrr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ChristopherHX
> your unrelated docker_run.go is causing the failure (I suggest to split it out into another PR).

### @ChristopherHX
> found breaking change I don't like to see

### @ChristopherHX
> A is how it was before...I agree B is better than A (would this has been your initial new behavior I wouldn't have commented about it).

### @AndesKrrrrrrrrrrr
> What should we do in this case?

### @ChristopherHX
> Looks good to me, the comments about tests don't have to be addressed as they would still work.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
