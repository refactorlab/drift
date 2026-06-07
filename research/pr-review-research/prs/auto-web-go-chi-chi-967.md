# go-chi/chi #967 — feat: middleware.ClientIP, a replacement for middleware.RealIP

**[View PR on GitHub](https://github.com/go-chi/chi/pull/967)**

| | |
|---|---|
| **Author** | @VojtechVitek |
| **Status** | Merged (by pkieltyka, May 22, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @convto
> I've checked the implementation, and I completely agree with the approach. It addresses the concerns beautifully.

### @rezmoss
> middleware.realip itself is unchanged...suggest keeping them as 'no fix, realip deprecated, migrate to clientipfrom' instead of assigning a patched ver

### @VojtechVitek
> I've marked `middleware.RealIP` as deprecated in this PR. Anything else we can do here? We can't remove it...due to semver compatibility.

### @adam-p
> Engaged in detailed discussion on IP normalization, v4-mapped IPv6 handling, and zone stripping—core security mechanisms.

### @Saku0512
> Approved changes after multiple rounds, with particular attention to boundary cases and bypass prevention mechanisms.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
