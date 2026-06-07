# vitessio/vitess #17763 — Add semi-sync monitor to unblock primaries blocked on semi-sync ACKs

**[View PR on GitHub](https://github.com/vitessio/vitess/pull/17763)**

| | |
|---|---|
| **Author** | @GuptaManan100 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mattlord
> it requires setting port forward rules (on Mac) or iptable changes (on Linux), both of which require sudo access

*Additional reviewer engagement from @mattlord and @deepthi centered on proto/SQL schema additions for tracking semi-sync recovery state, flag documentation, and avoiding ambiguous field selection in the monitor query; the conversation page did not surface further verbatim substantive prose beyond the quote above.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
