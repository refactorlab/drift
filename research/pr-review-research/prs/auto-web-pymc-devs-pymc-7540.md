# pymc-devs/pymc #7540 — Add ZarrTrace

**[View PR on GitHub](https://github.com/pymc-devs/pymc/pull/7540)**

| | |
|---|---|
| **Author** | @lucianopaz |
| **Status** | Merged (Jan 10, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @michaelosthege
> It should be quite simple to implement a `ZarrBackend` with McBackend! I would recommend to do that first, because McBackend's test suite already covers all (?) of the nasty edge cases.

### @maresb
> have you done some benchmarks with this yet (in particular with S3)? I'm a bit concerned that with (1, 1, ...) chunk size that I/O will be a bottleneck.

### @aseyboldt
> zarr will write the whole chunk each time we set a draw here, even if that chunk is not full yet... we should be able to speed this up a lot if draws_per_chunk is >1 if we buffer.

### @OriolAbril
> Praised the direction and suggested future enhancements around enriched sample_stats and unconstrained space sampling, noting these represent longer-standing feature requests. *(Note: this reviewer's prose was summarized on the conversation page rather than fully quotable verbatim via web fetch.)*

### @ricardoV94
> Flagged potential issues with sharing compiled functions across parallel chains without proper random generator state management, referencing related issue #7588. *(Note: summarized on the conversation page; exact verbatim text not web-retrievable.)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
