# tower-rs/tower #805 — chore: Replace type related to future with standard library

**[View PR on GitHub](https://github.com/tower-rs/tower/pull/805)**

| | |
|---|---|
| **Author** | @tottoto |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Darksonn
> If we are removing this, we probably want the removal to appear in the changelog, which may require this change to happen in a dedicated PR.

### @jplatte
> Do people really enable features with `__`-prefixed names? It seems pretty clear that it's internal and may go away at any time..

### @Darksonn
> The standard library also has the `pin!` macro that can replace this. That may also make sense to update in this PR.

### @jplatte
> Not possible without bumping MSRV from 1.64 to 1.68.

### @tottoto
> This time, I have addressed this without updating the MSRV. I will update the MSRV and also address `pin_mut` if it is more appropriate.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
