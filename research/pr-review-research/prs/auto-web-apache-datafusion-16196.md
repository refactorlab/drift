# apache/datafusion #16196 — feat: Allow cancelling of grouping operations which are CPU bound

**[View PR on GitHub](https://github.com/apache/datafusion/pull/16196)**

| | |
|---|---|
| **Author** | @zhuqi-lucas |
| **Status** | Merged (June 9, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pepijnve
> In my own testing with `partition_count = 1` group by aggregates suffer from the same problem

### @pepijnve
> His repo seems to be creating a plan manually and applying some old version of the rule (which is in that repo, not in DF proper).

### @alamb
> I like that this has a 'escape valve' too -- if this mechanism isn't working we can disable the new yields via config

### @alamb
> So maybe we need a follow on PR to fix the cancel test from @pepijnve

### @ozankabak
> I think it would be great to create some tickets to track: 1. Adding a few tests (maybe SLT?) that show `YieldStreamExec` being inserted

### @ozankabak
> Where we are at currently is not where we will ultimately be, this is just a step in a long process.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
