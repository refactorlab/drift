# influxdata/telegraf #18183 — feat(inputs.sip): Add plugin

**[View PR on GitHub](https://github.com/influxdata/telegraf/pull/18183)**

| | |
|---|---|
| **Author** | @paulojmdias |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @srebhan
> Please consider allowing only one server per plugin instance to simplify the plugin code by avoiding parallelization within the plugin.

### @srebhan
> Why not using the credentials directly if the user specified them? In the worst case you are doing two queries instead of one for authenticated servers!

### @srebhan
> How about changing this to [mockServer pattern] and not using the `require` package in there? Please also move the utility code to the bottom of the file!

### @srebhan
> Do not use `require` in the mock-server implementation. Instead return an error there and then use the `require` package in the actual tests to check that error.

### @skartikey
> Thanks for sticking with this PR and addressing the feedback so far. I've left a few additional comments, please take a look when you get a chance.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
