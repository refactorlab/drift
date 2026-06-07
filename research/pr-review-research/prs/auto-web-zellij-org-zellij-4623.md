# zellij-org/zellij #4623 — Fix partial sequences parsing

**[View PR on GitHub](https://github.com/zellij-org/zellij/pull/4623)**

| | |
|---|---|
| **Author** | @jgiannuzzi |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @imsnif
> [Suggested moving away from legacy polling code toward an async approach using `select!` listening to multiple channels rather than a simple timer-based solution.]

### @imsnif
> [Expressed concern about] sweeping changes close to a release [and requested a more minimal fix using synchronous `select` with a debounce subchannel instead.]

### @jgiannuzzi
> a stdin 'pump' thread that is responsible for looping...over stdin reads, passing the result over a channel [with timeout-based finalization]

### @imsnif
> [Requested converting the vendored `termwiz` crate into a module within `zellij-utils` to avoid publishing issues on crates.io.]

### @imsnif
> 100K+ lines and 40+ dependencies are not good for my anxiety.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
