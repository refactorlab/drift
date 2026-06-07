# nodejs/node #55085 — module: unflag --experimental-require-module

**[View PR on GitHub](https://github.com/nodejs/node/pull/55085)**

| | |
|---|---|
| **Author** | @joyeecheung |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @DavidAnson
> The new console output produced by this experimental feature will fail CI for markdownlint-cli2...opting everyone into an experimental change to fundamental loader behavior is not a minor change.

### @xt0rted
> This change silently broke one of our build steps...there were no errors or warnings in the console, and node itself didn't emit anything.

### @voxpelli
> It does look fairly common to do a fallback based on whether the thrown exception is `ERR_REQUIRE_ESM`...the one case that still would need that fallback, the top level awaits, will not get that fallback.

### @joyeecheung
> Backport in #56927 — indicating the feature was backported to v20, expanding its scope across LTS versions.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
