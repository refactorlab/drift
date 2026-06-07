# kubernetes/enhancements #4565 — KEP-4563: EvictionRequest API

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/4565)**

| | |
|---|---|
| **Author** | @atiratree |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @thockin
> At this point in the proposal I can't answer it myself - what happens if the user specifies this?

### @thockin
> I think this KEP makes the whole thing feel scarier than the core of it actually is...I see this as basically a controlled way to iterate a list.

### @thockin
> What if my interceptor involves unregistering the pod from some expensive external system, and then the whole thing is cancelled?

### @thockin
> I really hate this word. Irrationally. Is 'EvictionHandler' or something off the table?

### @wojtek-t
> I don't think fan-out to N pods is the right way to do, because these pods will often be dependent on each other, forming a runtime gang.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
