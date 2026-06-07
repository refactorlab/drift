# yarnpkg/berry #7089 — Makes `enableScripts: false` the default

**[View PR on GitHub](https://github.com/yarnpkg/berry/pull/7089)**

| | |
|---|---|
| **Author** | @arcanis |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @clemyan
> I think adding a migration that sets `enableScripts: true` on existing projects will make this change non-breaking?

### @clemyan
> I feel like however we slice this ends up being a tradeoff between correctness and security... making a migration like this bumps the lockfile version, so `yarn install` won't silently pass on CI anyway.

### @GNUGradyn
> this would pretty much completely break installing packages from git out of the box and the supply chain attack would still succeed as soon as the library is actually used.

### @onigoetz
> I welcome this change but am puzzled at how to use this feature. I would like to enable postinstall only for some packages and disallow for all others.

### @wickkidd
> Now I have to go modify my renovate centralized configs to account for this anomaly and go manually update over 50 repos. This makes semver meaningless.

### @naugtur
> If making something more secure becomes a breaking change in a niche configuration it's still totally worth it... I'd consider giving them a nudge when the migration happens.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
