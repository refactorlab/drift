# grafana/k6 #3743 — Add an experimental csv module exposing a streaming csv parser

**[View PR on GitHub](https://github.com/grafana/k6/pull/3743)**

| | |
|---|---|
| **Author** | @oleiade |
| **Status** | Merged (September 10, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @joanlopez
> Take this just a simple idea rather than something that's really a requirement for this pull request to move forward, but considering that you explicitly mentioned that, would be nice to have a small benchmark for comparison.

### @olegbespalov
> I might be wrong since I am missing a module context, but this seems like a breaking change. Since later on there is logic that depends on this handling this error type.

### @olegbespalov
> I meant that the breaking change is that previously, the read method in case of the EOF resolves with null, whenever after the changes, it's probably resolved with the EOF error.

### @joanlopez
> Thanks for giving form to what we started during the Crococon 💟 I left multiple comments as some form of initial feedback, but generally speaking I think this approach is more than okay, and from my side I'd suggest to move forward (with tests and all that) 🚀

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
