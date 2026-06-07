# vectordotdev/vector #21248 — feat(postgres sink): Add postgres sink

**[View PR on GitHub](https://github.com/vectordotdev/vector/pull/21248)**

| | |
|---|---|
| **Author** | @jorgehermo9 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pront
> Hi @jorgehermo9, thank you for this sizable contribution! On a high level, it looks great. I did a first review and left some comments.

### @jorgehermo9
> This PR is not 100% ready by my side and there will likely be a few things wrong, but had a few questions and wanted to know if the direction seems right...

### @jorgehermo9
> I inspired a lot from the `databend` and `clickhouse` sinks, but left a few questions as TODOs in the source. I found this sink a bit different from the others, as the others had the `request_builder` thing and encoding the payload in bytes (as most of the sinks are http based)..

### @pront
> Seems this is 99% ready. Some final tweaks to the docs and spell checking fixes are required.

### @jorgehermo9
> I had to update the website layout to handle `exactly_once` delivery, as this was the first sink of that kind!

### @simplepad
> I noticed that setting `healthcheck.enabled` to `false` doesn't prevent vector from exiting with an error if the endpoint specified in the `endpoint` doesn't exist when it starts up, is that expected behavior?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
