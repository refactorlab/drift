# alpinejs/alpine #4186 — Allow debouncing/throttling x-model when using x-modelable

**[View PR on GitHub](https://github.com/alpinejs/alpine/pull/4186)**

| | |
|---|---|
| **Author** | @lastlambda |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ekwoka
> For some clarity, the outer value means the theoretical state side (like a normal components data), while the inner value means the x-modelable (like the inputs value)?

### @SimoTod
> For your project, is there a reason why you can't debounce the internal x-model (just to understand the use case)?

### @SimoTod
> The point is that this PR, not being very robust (as you said, both approaches as you said are currently sub-optimal), needs a lot of demand to be merged.

### @lastlambda
> I have a min-max slider which are already being modelled with two internal values...I then want to debounce this input back out to a set of search filters.

### @calebporzio
> When `inner` changes, `x-modelable` uses `entangle()` to sync the value outward...completely bypasses the `.debounce` modifier.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
