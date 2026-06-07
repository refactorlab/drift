# apache/cassandra #3416 — CEP-15: (Accord) sequence EpochReady.coordinating to allow syncComplete to be learned from newer epochs

**[View PR on GitHub](https://github.com/apache/cassandra/pull/3416)**

| | |
|---|---|
| **Author** | @dcapwell |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ifesdjeen
> Should we do the same in `mapReduceForKey`? There we also have `for (Key key : commandsForKeys.keySet())`

### @ifesdjeen
> This approach will only be able to reconstruct epochs from the local log. If we want an arbitrary epoch - we will need to go to the CMS node and ask it to reconstruct it from the distributed log.

### @ifesdjeen
> Just to make sure: do we want to just ignore non-successes? Or do we want to retry on failure? I'd say the latter.

### @ifesdjeen
> Since we are not testing anything Accord-specific here ... any reason not to use Harry here just like the rest of `Consistent*Test` do?

### @ifesdjeen
> This class is currently at almost 900LOC ... I would ... move enums ... up, since they help the person understand what's going on in the class.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
