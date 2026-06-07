# duckdb/duckdb #17992 — Add Option to Allocate Using an Arena in `string_t`

**[View PR on GitHub](https://github.com/duckdb/duckdb/pull/17992)**

| | |
|---|---|
| **Author** | @maiadegraaf |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Mytherin
> I wonder if it would be a better idea to use a different class here? `string_t` is optimized for use with data - and the storage location of data is not clearly modeled as part of the `string_t`

### @Maxxen
> I wonder if it makes more sense to add a method to the arena instead of an additional constructor to string_t...arena.Copy<string_t>(str)

### @taniabogatsch
> I like that - I was already wondering how we could pass the allocator to `string_t(...)` in a more generic way...if we move this into the `ArenaAllocator` itself, then we can keep the `string_t` oblivious of its memory

### @Maxxen
> Another point of having the interface be on the ArenaAllocator itself is that we can potentially intercept the creation...track the average string-size, or...intern and deduplicate identical strings

### @Mytherin
> Maybe we can make that a const reference in a follow-up PR so we can remove the call to `ToStdString`?...the end goal should be to get rid of all instances of `ToStdString`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
