# DioxusLabs/dioxus #3195 — Restore manganis optimizations

**[View PR on GitHub](https://github.com/DioxusLabs/dioxus/pull/3195)**

| | |
|---|---|
| **Author** | @ealmloff |
| **Status** | Merged (by jkelleyrtp on November 26, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jkelleyrtp
> it really would not be terrible to cut out the asset system (Manifest, optimizer, etc) into its own crate again... and maybe with some feature flags so we can gate `dev` mode `dx`

### @jkelleyrtp
> do we _want_ to be actually hashing assets at compile time? I'm a bit worried about long compile times - maybe there's a way we can inject metadata into the assets on the filesystem

### @ealmloff
> Metadata isn't preserved in git, so we shouldn't use it for asset versioning... We could only hash the file in release mode if compile times are an issue.

### @jkelleyrtp
> it would be nice if the serialized bytes were valid json but I get how the const_serialize can't do that in a general case.

### @ealmloff
> I think that is possible, but it would require a lot more logic to parse and format strings at compile time... postcard is a much simpler well defined serialization format that might be easier to target than json.

### @jkelleyrtp
> ImageAsset::options() might be more discoverable? (suggesting a more discoverable options API)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
