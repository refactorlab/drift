# yarnpkg/berry #6750 — feat(plugin-npm): add npm provenance support

**[View PR on GitHub](https://github.com/yarnpkg/berry/pull/6750)**

| | |
|---|---|
| **Author** | @GauBen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @arcanis
> I'm concerned about the number of dependencies this brings in. We try not to rely on the npm libraries, and here we're adding a bunch of them for a small feature. Is sigstore well-speced enough that we can afford to just call whatever endpoints are needed ourselves?

### @arcanis
> I'd have liked to have some tests though, as I'm refactoring various parts of Yarn and I'm concerned I could accidentally break this in the future. Do you think you could look at that as a follow-up?

### @lsd-cat
> It is likely that we will continue the development of WEBCAT in the next months, so if there is community interests in reusing the sigstore/tuf implementations there, perhaps we could collaborate on them? Our main requirements would be to keep them browser native and without runtime dependencies.

### @aduh95
> Is this the actual recommendation? Shouldn't it be using an env variable instead? — regarding hardcoding credentials in CI examples.

### @GauBen
> I measured the weight of the feature... With tuf-js patch: 2,998,829 B (+8.4%) — addressing dependency concerns through optimization.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
