# nats-io/nats-server #6966 — (2.12) Initial atomic batch publish

**[View PR on GitHub](https://github.com/nats-io/nats-server/pull/6966)**

| | |
|---|---|
| **Author** | @MauriceVanVeen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @derekcollison
> This seems to imply that every message has a reply. Not sure that should be the case, and that we should only respond to the last message in a batch.

### @ripienaar
> I dont think this is right, if you accept these headers and check them against the pre-batch state before committing the batch and while the lock is held it all makes perfect sense.

### @neilalexander
> Presumably we don't need to allocate this if batching is disabled on the stream?

### @neilalexander
> Wonder if we should be making sure that this map can't grow infinitely, especially because maps never shrink.

### @derekcollison
> Since new lock vs mset mu, should check acquire the lock instead?

### @bruth
> I agree with generalizing it as the core API and then a convenience function that takes a slice as a one-shot.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
