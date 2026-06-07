# influxdata/telegraf #15988 — feat(inputs.firehose): Add new plugin

**[View PR on GitHub](https://github.com/influxdata/telegraf/pull/15988)**

| | |
|---|---|
| **Author** | @syedmhashim |
| **Status** | Merged (January 22, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @srebhan
> I urge you to keep the code as simple and less nested as possible to ease review and debugging. And of course some unit-tests would be great!

### @srebhan
> Yeah we do have some older code we didn't adapt yet but things changed both on the golang side as well as on us being more strict with the way things are done.

### @srebhan
> That looks much better! Some very small things with the biggest being that log messages should start with a capital letter... The only thing missing are the unit-tests...

### @srebhan
> Regarding the tests, I suggest that you don't test the request separately but simply use a http client and send data to the plugin. You might also want to implement a general test-case setup similar to what we do in socket listener tests...

### @srebhan
> Really nice! Some very small things with the biggest being that log messages should start with a capital letter... The only thing missing are the unit-tests...

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
