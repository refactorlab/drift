# argoproj/argo-workflows #13393 — docs: synchronization and paralellism docs improvements

**[View PR on GitHub](https://github.com/argoproj/argo-workflows/pull/13393)**

| | |
|---|---|
| **Author** | @Joibel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @agilgur5
> if it's documented, people won't file bug reports or fix it necessarily -- it's expected behavior. If we link to an existing bug report, or otherwise state that this behavior may be optimized in the future, I think that could be ok

### @agilgur5
> I'm wondering if maybe we split out cluster-level parallelism into the Operator Guide instead of an adjacent page in the User Guide. That would definitely keep the intents aligned.

### @blkperl
> Can we add an example where the `mutex` name is dynamic? For example, a workflow or multiple workflows that interact with the same external resource such as a database

### @blkperl
> Is there any impact from a controller restart (voluntary or involuntary) that impacts parallelism or synchronization that we should document?

### @Joibel
> Mutexes and semaphores are the proper answer to almost all actual problems...They are much more explicit about which sections need the lock

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
