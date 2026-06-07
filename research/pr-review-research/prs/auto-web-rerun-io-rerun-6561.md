# rerun-io/rerun #6561 — Map View and `GeoPoints` archetype

**[View PR on GitHub](https://github.com/rerun-io/rerun/pull/6561)**

| | |
|---|---|
| **Author** | @tfoldi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jleibs
> I talked this one over with some folks and the desire is to keep ViewCoordinates separate and somewhat dedicated to interpretation of camera-orientation, as distinct from data semantics.

### @abey79
> by 'feature flag', we don't necessarily mean a Cargo-style feature, but a global application setting which dynamically enable/disable the map view in the viewer...users already have to explicitly opt-in by logging a new, specific `GeoPoints` archetype.

### @Wumpf
> Walkers debug log is a bit spammy, we should add it to `CRATES_AT_INFO_LEVEL` since in the dev environment we default to debug log level otherwise

### @tfoldi
> There are many moving parts in Rerun, and with so much auto-generated code and changing internals, maintaining consistency across view-related PRs isn't straightforward.

### @samorr
> Is there any plan to make GPS coordinates using `float64`? With 32 bits it's very 'rough'

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
