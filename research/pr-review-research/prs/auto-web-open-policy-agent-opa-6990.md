# open-policy-agent/opa #6990 — Add a new inter-query value cache to cache data across queries

**[View PR on GitHub](https://github.com/open-policy-agent/opa/pull/6990)**

| | |
|---|---|
| **Author** | @ashutosh-narkar |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @johanfylling
> the existing inter-query cache is a by-size cache, and the new glob- and regex caches are by-count...I wonder if we should also treat the new caches as general purpose, so that custom built-ins can still use them

### @johanfylling
> Since regexes aren't the only possible thing on the cache, we should probably assert the returned type...we could also do this inside the old `updateCacheConfig()`?

### @johanfylling
> when inserting into the cache we check `c.maxNumEntries`, but this is updating `c.config`. What I think I'm not seeing is how updating the latter changes the former.

### @johanfylling
> Should this new cache do the same? `string` type keys aren't necessarily the most convenient type for custom built-ins that might want to use this.

### @johanfylling
> This is the primary point of discovery for built-in developers, right? Should we add to the description that this cache is for entries that can't easily have their size calculated

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
