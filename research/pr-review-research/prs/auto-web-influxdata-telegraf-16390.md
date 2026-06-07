# influxdata/telegraf #16390 — feat(inputs.fritzbox): Add plugin

**[View PR on GitHub](https://github.com/influxdata/telegraf/pull/16390)**

| | |
|---|---|
| **Author** | @hdecarne |
| **Status** | Merged (March 18, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @srebhan
> try to use a structure and naming similar to those in other plugins.

### @srebhan
> Pointed out that a new `testutil.IgnoreType` function was being added (PR #16493) to handle ValueType comparison issues in tests, offering to rebase once merged.

### @Hipska
> Suggested improving tag naming conventions and removing a debug flag, recommending the plugin use log levels instead of custom debugging mechanisms.

### @Hipska
> Requested reworking of plugin logging output to emit proper line protocol format, aligning with Telegraf standards.

### @Hipska
> Noted wait group implementation issues and referenced Go documentation on proper WaitGroup usage patterns.

### @skartikey
> Requested minor clarifications about error handling and variable naming during final review before approval.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
