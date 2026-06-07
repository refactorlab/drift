# crystal-lang/crystal #14167 — Add `WaitGroup` synchronization primitive

**[View PR on GitHub](https://github.com/crystal-lang/crystal/pull/14167)**

| | |
|---|---|
| **Author** | @ysbaddaden |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @straight-shoota
> I think we'll need a bunch more tests for this. E.g. for multiple `#wait` calls, fibers adding more fibers, `#add` with negative delta or `#done` called before `#wait`.

### @straight-shoota
> Go seems to merge the lock and counter int a single atomic field... This removes the need to keep track of waiting fibers, they just stay blocked.

### @ysbaddaden
> Crystal relies on LLVM atomics that always return the old value... For example, to support `add(-5)` I must do the math twice.

### @RX14
> At the cost of using a `compare_and_set` loop, it would be possible to 'saturate' counter decrements at 0 and provide a guarantee.

### @RX14
> My highest concern is deadlocks: any condition where the counter remains on zero but fails to resume a waiter.

### @alexkutsan
> One proposal... is to make the `wait` method compatible with `select` to support... when wg.wait... when timeout(X.seconds).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
