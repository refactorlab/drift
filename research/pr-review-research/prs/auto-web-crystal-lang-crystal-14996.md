# crystal-lang/crystal #14996 — Refactor Lifetime Event Loop

**[View PR on GitHub](https://github.com/crystal-lang/crystal/pull/14996)**

| | |
|---|---|
| **Author** | @ysbaddaden |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @straight-shoota
> The failure happens on the `pull_request` trigger which runs in the merge branch... The PR is currently based on an old commit from master and a compiler built from that misses #14718.

### @GeopJr
> ulimit -Hn: 1073741816 ... Can confirm that it compiles successfully, thanks!

(Identified a memory allocation problem with high file descriptor limits, resolved by using soft limits instead of hard limits.)

### @ysbaddaden
> The theory is that being notified for readiness (once thanks to edge-triggered) is less expensive than always modifying the polling system. In practice... we notice up to 20% performance improvement.

### @ysbaddaden
> I solved it with the requirement that to resume an IO event with a timeout we must successfully dequeue the event from both queues... and a bias on timers: they always win.

### @ysbaddaden
> A limitation is that trying to move a fd from one evloop to another while there are pending waiters will raise an exception.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
