# vectordotdev/vector #20859 — feat(codecs): Implement chunked GELF decoding

**[View PR on GitHub](https://github.com/vectordotdev/vector/pull/20859)**

| | |
|---|---|
| **Author** | @jorgehermo9 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jszwedko
> I like the idea of having a configurable bound on the number of pending messages. The chunked encoding is only used for UDP, yes? Shouldn't that provide a defacto bound on size?

### @jszwedko
> I was hoping the reference implementation would serve as prior art here, but [Graylog] seems like they have no pending message limit, just the timeout of 5 seconds as you have. I think I'd suggest having this as an option for people that do want to bound the memory, but default to unlimited to match Graylog server behavior.

### @jszwedko
> We could add a `max_length` option. This would be consistent with other framers... In `chunked_gelf`'s case, I think we'd want to limit the length of the accumulated chunks in addition to each individual chunk.

### @jszwedko
> Ah, yes, I think we'd want to discard messages that exceed the limit (in the future we can route them to a "dead letter" output). This is consistent with the other framers.

### @jszwedko
> Let's leave the default as `None` to match the other framers. Could we call this just `max_length`, though, also to match the other framers?

### @jszwedko
> [We could] create a separate "stream" by grouping together packets from the same source IP / port... if you are ever interested, [lading] is the tool we use to generate load for benchmarks.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
