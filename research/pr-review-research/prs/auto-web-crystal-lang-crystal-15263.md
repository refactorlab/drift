# crystal-lang/crystal #15263 — Add support for IPv6 scoped addresses (RFC4007)

**[View PR on GitHub](https://github.com/crystal-lang/crystal/pull/15263)**

| | |
|---|---|
| **Author** | @foxxx0 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @straight-shoota
> Could you please open an issue as a feature request first? We ask this to separate high-level discussion of the feature (in the issue discussion) from details of this specific PR

### @straight-shoota
> IMO input and output types should always be identical, so `Int32` both for the parameter type and the return type.

### @HertzDevil
> Windows CI is failing, because Win32 presumably does not set `errno` at all, and the `ENOENT` you're seeing probably came from another C runtime function call

### @straight-shoota
> Don't worry about squash/rebase. We do that when merging. Commit history in the PR is best left as is.

### @ysbaddaden
> raise exception from errno on non-windows platforms

### @straight-shoota
> Requested that newly introduced methods maintain consistent type signatures to avoid runtime errors and enable compile-time validation through implicit casting restrictions.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
