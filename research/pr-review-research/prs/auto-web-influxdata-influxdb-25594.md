# influxdata/influxdb #25594 — feat: Modify optimized compaction to cover edge cases

**[View PR on GitHub](https://github.com/influxdata/influxdb/pull/25594)**

| | |
|---|---|
| **Author** | @devanbenz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidby-influx
> Either there is some invariant (e.g., the first file is always the largest) which is neither tested nor documented, or these conditionals are heuristic, not reliable.

### @davidby-influx
> Skip the file if... is misleading, because we are skipping a generation which may contain more than one file, are we not?

### @davidby-influx
> extract the code...into a named function or local lambda...You may be able to have one test function that does all the cases

### @gwossum
> Table-driven testing FTW!

### @davidby-influx
> you were right...to change Plan and PlanLevel minimally...to minimize the risks in what is already a large change

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
