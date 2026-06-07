# spring-projects/spring-framework #33705 — Fix `PathMatchingResourcePatternResolver` manifest classpath discovery

**[View PR on GitHub](https://github.com/spring-projects/spring-framework/pull/33705)**

| | |
|---|---|
| **Author** | @philwebb |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jhoeller
> manifest entries are actually meant to be URLs, not file paths. The approach taken there seems similar to ours in terms of manifest parsing, so I suppose we can proceed with this PR but we should review our assumptions in terms of file path parsing, accepting URLs as well?

### @jhoeller
> Such a significant refactoring in such a subtle core area seems better off in 6.2 for me, fixing the problem for Boot 3.4 rather than 3.3.x.

### @philwebb
> I think this code is the current source of truth and it does look a little more involved than my PR. I will try to align our logic with theirs.

### @juliojgd
> Maybe this `System.out` was an early debug line? (I'm just pointing it out in case it should be removed before the merge).

### @philwebb
> This stuff is hard to debug because breakpoints don't work. It was an accident. Will fix.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
