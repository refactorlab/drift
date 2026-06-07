# envoyproxy/envoy #35545 — access log: new 20x faster json formatter implementation

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/35545)**

| | |
|---|---|
| **Author** | @wbpcode |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jmarantz
> The big win will be to not use a protobuf as an intermediate format, but purely use the json streamer.

### @jmarantz
> I should also say: this is great work! And even without the suggestions I have made it's a huge improvement, though I'm not entirely clear why the old one was so slow

### @jmarantz
> can we pick a better name than TmplString? TemplateString? Add comments to both of these options indicating what they mean?

### @jmarantz
> perf nit: I think absl::variant might be overkill since both options have the same type underneath...Or if you were really after performance you'd make the first character

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
