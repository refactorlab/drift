# metabase/metabase #38400 — Caching: new strategies and configuration API

**[View PR on GitHub](https://github.com/metabase/metabase/pull/38400)**

| | |
|---|---|
| **Author** | @piranha |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @metamben
> This name only makes sense as long as the multiplier is 1000, right? I find this strange.

(regarding the `max-age-seconds` variable naming)

### @metamben
> This can be elegantly done by `t2/select-pk->fn`.

### @metamben
> If it's important, it should be documented. If it's not important, why not `doseq`?

(questioning return-value usage in the schedule-invalidation task)

### @qnkhuat
> any reason why we want the underscore pattern here?

(questioning underscores vs hyphens in field names like `min_duration`)

### @crisptrutski
> I hadn't thought about non-matching id's being implicitly filtered out for other models, and agree it's nice to be consistent.

(discussing filtering behavior for root cache configs)

### @metamben
> Might as well fix these too. 😁

(suggesting fixes to log statements using the `(trs ...)` pattern)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
