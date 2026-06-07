# spring-projects/spring-boot #50095 — EndpointRequest links matcher unnecessarily matches HTTP methods other than GET

**[View PR on GitHub](https://github.com/spring-projects/spring-boot/pull/50095)**

| | |
|---|---|
| **Author** | @dlwldnjs1009 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wilkinsona
> Thanks, @dlwldnjs1009. The links endpoint only supports `GET` requests but this certainly doesn't do any harm.

### @wilkinsona
> With the proposed change, you can configure the HTTP method for links when using `toAnyEndpoint()` but not when using `toLinks()`. That doesn't feel quite right. I'm wondering if we should just hardcode `GET` and document that's what happens.

### @wilkinsona
> We discussed this today and would like to go for the hardcoded `GET` approach. If you could update the PR, that would be much appreciated.

### @philwebb
> Changed the issue classification from "task" to "bug," signaling team consensus that this represented a defect rather than enhancement work. (action recorded on the conversation timeline; no verbatim prose comment)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
