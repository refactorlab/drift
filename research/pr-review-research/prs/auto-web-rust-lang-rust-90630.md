# rust-lang/rust #90630 — Create real parser for search queries

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/90630)**

| | |
|---|---|
| **Author** | @GuillaumeGomez |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jyn514
> I really wish you'd talked this over with the team before adding lots more custom syntax. I was under the impression you were fixing bugs, not adding entirely new features.

### @camelid
> It exposes way too much of rustdoc's internals, and it'll likely confuse users. Instead, we should try to make rustdoc's search 'Just Work' the way users expect.

### @jsha
> For simple searches containing only letters, we do substring matching...However, as soon as the query get any more complicated...we do exact match on each token.

### @notriddle
> Well, all four-token checks pass when run against the fuzzer. They seem to be parsing the same language now!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
