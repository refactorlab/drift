# grpc/grpc-go #7498 — pickfirst: New pick first policy for dualstack

**[View PR on GitHub](https://github.com/grpc/grpc-go/pull/7498)**

| | |
|---|---|
| **Author** | @arjan-bal |
| **Status** | Merged (October 10, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zasweq
> According to Mark, this is an implicit requirement out of the resolver (I asked about WRR and Outlier Detection).

### @dfawley
> you should say something like 'Is changed to `pick_first` in init() if this...' so it's clear what it changes to, not just _that_ it changes.

### @dfawley
> Can we move this LB policy into the pickfirst package?

(and later)

> Is there any strong reason to keep it in a separate package at all?

### @dfawley
> This is a bit intertwined with the behavior of the calling function -- it needs this to be `Idle` to cause it to connect. A comment here might be a good idea.

### @dfawley
> You can move these tests into `pickfirstleaf` and be `package pickfirstleaf_test` instead... Having a separate package for only tests is generally not ideal.

### @easwars
> Here, pick_first could be the top-level LB policy on the channel and there is no guarantee that the name resolver being used does not send duplicate addresses.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
