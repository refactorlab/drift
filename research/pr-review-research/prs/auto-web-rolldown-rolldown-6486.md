# rolldown/rolldown #6486 — feat(rolldown): support `output.clearDir` to clean up `dir` before build

**[View PR on GitHub](https://github.com/rolldown/rolldown/pull/6486)**

| | |
|---|---|
| **Author** | @aprosail |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hyf0
> Could you also change the option name to `cleanDir`?

### @hyf0
> Could you run `just lint` locally and fix related errors.

### @lazka
> It seems this is being run after `generateBundle` and before `writeBundle`...which results in all files emitted by plugins before `writeBundle` being deleted too. Is that on purpose?

### @hyf0
> If this's common community plugin pattern, It's ok to advance the timing.

### @aprosail
> [#6647] how about a fix like this? This PR already clean dir before the `generateBundle` hook, that all files generated inside the `generateBundle` hook will not be deleted.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
