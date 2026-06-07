# slint-ui/slint #11052 — safe-ui: implement interrupt-safe FFI callback queue

**[View PR on GitHub](https://github.com/slint-ui/slint/pull/11052)**

| | |
|---|---|
| **Author** | @marcothaller |
| **Status** | Merged (by tronical on Mar 25, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tronical
> I'm convinced that we should separate two concerns: 1. The ability to run code that originates from an ISR within the main thread/task of slint...2. The ability to provide user interface related events...For the former, the API we have in the rest of Slint is basically `invoke_from_event_loop()`

### @tronical
> When that works, then we can build the event delivery on top of that.

### @marcothaller
> This PR is now stripped down and adds interrupt-safe FFI callback queue only. I have moved the event delivery code to a second PR: #11057

### @tronical
> Great, I think we're almost there :)

### @tronical
> One last nit left ;-) (regarding module organization)

### @marcothaller
> Thank you Simon for reviewing the code. All your remarks should be resolved now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
