# influxdata/influxdb #27312 — fix: config environment override improvements

**[View PR on GitHub](https://github.com/influxdata/influxdb/pull/27312)**

| | |
|---|---|
| **Author** | @gwossum |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidby-influx
> I would wrap all errors returned as strings, but I'm open to dissent if I'm missing something.

### @davidby-influx
> Is that what we want? Why not respect the local `GetEnv` if there is one? It would seem to make testing easier to do so.

### @gwossum (author)
> This behavior of using the unindexed environment value as a default for existing slice values is very strange, but it is what OSS and plutonium have both been doing.

### @davidby-influx
> Would this be better as a named function? Lambdas with recursion (or alternating recursion) seem hard to reason about to me.

### @Copilot
> ReadBuffer is now toml.SSize but is cast directly to `int` before calling SetReadBuffer. Large values can overflow/truncate on 32-bit platforms.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
