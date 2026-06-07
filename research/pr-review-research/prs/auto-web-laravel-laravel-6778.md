# laravel/laravel #6778 — Remove axios and enable ignore-scripts

**[View PR on GitHub](https://github.com/laravel/laravel/pull/6778)**

| | |
|---|---|
| **Author** | @WendellAdriel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pataar
> It might be wise to also enable minimumReleaseAge. min-release-age=2 # days. Most affected packages are less that that age old.

### @pushpak1300
> this is double edge swords. this means if any critical fixes or security fixes will be fixed after 2 days.

### @pataar
> That's the tradeoff. It is an effective measure against supply chain attacks though. 1 day would be sufficient as well.

### @pataar
> Also, note that ignore-scripts is not a golden bullet right now... You might need `allow-git=none` too.

### @SanderSander
> Only the `ignore-scripts=true` won't protected for a full 100% when a packages is compromised, the min-release-age would be a valuable extra protection here.

### @paulmax-os
> The min-release-age and allow-git flags require users to be on a recent version of npm. But that's why I would combine that with pinned deps.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
