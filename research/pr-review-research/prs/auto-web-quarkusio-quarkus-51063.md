# quarkusio/quarkus #51063 — Support @Transactional for Hibernate Reactive

**[View PR on GitHub](https://github.com/quarkusio/quarkus/pull/51063)**

| | |
|---|---|
| **Author** | @lucamolteni |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mmusgrov
> Will we be able to re-enable the JTA interceptor if we can arrive at a non-blocking API...XA is a blocking protocol (things like enlist and prepare etc must wait for concensus before moving onto the next phase).

### @yrodiere
> I didn't go through the tests but I feel they're WIP anyway, so I felt it would be better to just send this.

### @yrodiere
> I promise I tried to limit the number of comments. It's way less than before! Thanks for all the tests BTW, that gives me much more confidence about the whole thing.

### @yrodiere
> According to Develocity...This is just a flaky test, ignoring. We're good then, merging!

### @FroMage
> Looks great to me :) Congrats on getting this done!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
