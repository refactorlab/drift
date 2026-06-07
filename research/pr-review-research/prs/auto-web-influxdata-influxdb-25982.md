# influxdata/influxdb #25982 — feat: add optional token hashing

**[View PR on GitHub](https://github.com/influxdata/influxdb/pull/25982)**

| | |
|---|---|
| **Author** | @gwossum |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidby-influx
> A variety of smaller issues. I will need to review this again to fully understand the larger changes.

### @devanbenz
> Just a few comments mostly about extra safety checks and some error messaging. I've been able to get about half way through the PR.

### @philjb
> so terse it borders on inaccurate for everything this flag controls

(On the `--use-hashed-tokens` flag description.)

### @devanbenz
> Do you think it would be beneficial to add some sort of warning log or info log upon token creation or startup if there are already hashed tokens?

### @gwossum (author response)
> I think logging on startup that hashed tokens exist but hashed tokens are disabled is a good idea, though.

### @philjb
> the code makes assumptions about what the empty string means...not essential, but...there's a comment about it so it is essentially a special _type_ of token: an 'unset one'

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
