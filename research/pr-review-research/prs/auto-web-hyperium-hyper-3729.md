# hyperium/hyper #3729 — Change graceful_shutdown function behavior.

**[View PR on GitHub](https://github.com/hyperium/hyper/pull/3729)**

| | |
|---|---|
| **Author** | @ionut-slaveanu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @seanmonstar
> Why is this needed? If handshaking is taking a long time, it should still get closed, in my opinion.

### @seanmonstar
> That doesn't seem to me like what most people would want from this method. Consider: as implemented in this PR, if graceful shutdown is triggered a couple milliseconds after the connection starts, and thus gets ignored because of handshaking, then this connection will stay in an 'active' state indefinitely...

### @seanmonstar
> I could imagine a solution here: instead of just closing immediately, a flag could be set that as soon as the handshake is done, _then_ it starts the HTTP/2 graceful shutdown.

### @jeromegn
> This would be useful to us as we noticed we're closing connections abruptly if the h2 handshake is in progress and we're trying to gracefully shut down the server.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
