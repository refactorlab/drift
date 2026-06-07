# yarnpkg/berry #6688 — Improve pnp loader speed and memory: jszip implementation

**[View PR on GitHub](https://github.com/yarnpkg/berry/pull/6688)**

| | |
|---|---|
| **Author** | @goloveychuk |
| **Status** | Merged (Apr 7, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @arcanis
> Since the main benefit of this PR is to decrease the runtime footprint...I'd rather keep the existing codepath for unplug (to simplify the changes as much as possible).

### @arcanis
> We use `456789000` (see `SAFE_TIME`) — guidance on the correct constant to use for file modification times.

### @arcanis
> Can you move it to a `ZipImplementation.ts` file? — structural organization request for the new interface definition.

### @goloveychuk
> Usually js files are cached by infra...It's a rare case when some infra will read same file in one pnp runtime. — advocating for removing file caching to reduce memory consumption.

### @arcanis
> The libzip doesn't allow...to read files that just got written...The file caching was to workaround this issue. It's fine to get rid of it in the js backend. — explaining historical context for caching and approving its removal.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
