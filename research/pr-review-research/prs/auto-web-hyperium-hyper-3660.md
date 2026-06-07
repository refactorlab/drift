# hyperium/hyper #3660 — chore: fix unexpected cfg warning

**[View PR on GitHub](https://github.com/hyperium/hyper/pull/3660)**

| | |
|---|---|
| **Author** | @tottoto |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @seanmonstar
> A build file slows down compilation measurably. Can it be solved without?

### @tottoto
> I think another workaround is to allow this lint.

### @Darksonn
> Note that it's possible to add a ci check that still runs the lint, with your custom `--cfg`s allowed.

### @sfackler
> @dtolnay has a neat approach to avoid the build.rs build time penalty

### @seanmonstar
> That's clever, but I think currently my preferred solution is to just allow the lint normally, and optionally add a CI job checking it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
