# dart-lang/sdk #26012 — reflectType() dynamic type arguments support

**[View PR on GitHub](https://github.com/dart-lang/sdk/pull/26012)**

| | |
|---|---|
| **Author** | @pulyaevskiy |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @floitschG
> No need for the 'else' since the 'then' finishes with a 'return'.

### @rmacnak-google
> There should be a separate native that does the instantiation step.

### @floitschG
> we need to decide if we want to cache the types. In theory there is an unbound number... Either we don't cache, or we use a size-limited cache.

### @floitschG
> I think $checked == false. I don't think ! Works for not, only !=.

### @floitschG
> I think just testing for `vm` is a bad idea since it won't trigger for drt or dartium... I would go with `$compiler == none`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
