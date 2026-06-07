# rerun-io/rerun #10126 — New `VideoStream` archetype for loose video samples

**[View PR on GitHub](https://github.com/rerun-io/rerun/pull/10126)**

| | |
|---|---|
| **Author** | @Wumpf |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @emilk
> I have reviewed everything except the (very complicated) `video_stream_cache.rs`

### @emilk
> Let's mark `VideoStream` as `"attr.rerun.state": "unstable"`, then LGTM!

### @Wumpf
> still missing: better unit testing for all of this. We should be able to have some unit tests for the cache and some image comparison tests for video in general

### @Wumpf
(Acknowledges missing "web player support" and "smooth streaming" among other limitations, framing the PR as "the first piece of towards full streaming support" — foundational infrastructure rather than complete feature delivery.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
