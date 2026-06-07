# pymc-devs/pymc #7392 — Refactor model graph and allow suppressing dim lengths

**[View PR on GitHub](https://github.com/pymc-devs/pymc/pull/7392)**

| | |
|---|---|
| **Author** | @williambdean |
| **Status** | Merged (Jul 3, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ricardoV94
> Should `make_graph` and `make_networkx` now be functions that take plates and edges as inputs?

### @ricardoV94
> This logic feels rather convoluted to be honest. Maybe we can take a step back and see what is actually needed...Would the code be more readable if we didn't try to do both things at once?

### @ricardoV94
> I don't love the word meta, it's too abstract. `Plate.dim_names, Plate.dim_lengths, Plate.vars`?

### @ricardoV94
> Can we simplify? Could plate_meta be None for the scalar variables?

### @ricardoV94
> I think they should be in the same plate, because in the absence of dims, the shape is used to cluster RVs?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
