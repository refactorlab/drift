# grafana/k6 #4953 — Browser: add page.route

**[View PR on GitHub](https://github.com/grafana/k6/pull/4953)**

| | |
|---|---|
| **Author** | @AgnesToulet |
| **Status** | Merged (July 29, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mstoykov
> I am not certain on the exact separation that needs to happen here, but...the idea of the event loop...is to synchronize so nothing is executing or interacting the JS VM...the VU is also in general not thread safe

### @mstoykov
> This also is called off the event loop, so some of the mutex discussions...are actually valid - this can race. Do `let manyroutres = [route, route, route]; await Promise.all(manyroutes)`

### @ankur22
> Ok, i was under the impression that working with the js `runtime` in `promises` was safe to do since it was orchestrated in such a way to not cause a race condition

### @ankur22
> Do you need to protect this read with the `routesMu`?

### @mstoykov
> Why are we not appending to the end?

### @mstoykov
> I probably will make it an `make(chan error, 1)` and use it to return the error instead of having separate variable that is updated

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
