# nestjs/nest #14881 — fix(common): introduce magic file type validator to nestjs common

**[View PR on GitHub](https://github.com/nestjs/nest/pull/14881)**

| | |
|---|---|
| **Author** | @Chathula |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

All substantive review feedback came from maintainer @kamilmysliwiec, weighing the security motivation against dependency and ESM-compatibility trade-offs.

### @kamilmysliwiec
> Instead of introducing a new validator, we should probably just replace the logic of the existing one; otherwise we won't get rid of the vulnerability report

### @kamilmysliwiec
> I'm not sure if adding a hard dependency on package that has 20k/week downloads is safe though

### @kamilmysliwiec
> Is there any specific reason why eval-workaround doesn't work?

### @kamilmysliwiec
> `file-type` is an ESM-only package so in order to remain compatible with older versions of Node we'd have to either: a) use a different package b) use an older version of this package c) load it differently

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
