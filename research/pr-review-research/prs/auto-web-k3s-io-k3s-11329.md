# k3s-io/k3s #11329 — Rework loadbalancer server selection logic

**[View PR on GitHub](https://github.com/k3s-io/k3s/pull/11329)**

| | |
|---|---|
| **Author** | @brandond |
| **Status** | Merged (Dec 6, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @liyimeng
> With old implementation, we recently observe a panic when apiserver is offline.

### @brandond
> what you're describing sounds like #10317 which was fixed a while ago

### @brandond (PR design rationale, from description)
> The PR implements a clear server preference hierarchy: all connections target the same active server as long as it passes health checks; if a server fails, a new active server is selected from a preference order (servers recently recovered from failure, servers passing health checks, the default server, servers with partial recovery, and finally failed servers). The state machine across six server states (Unchecked, Standby, Recovering, Healthy, Preferred, Active, Failed) provides "more consistent behavior" and makes the system "easier to test and maintain."

Note: The substantive line-by-line review discussion on this PR (state-machine design, health-check transitions, fallback behavior) happened in inline file-review threads that were resolved and are lazy-loaded by GitHub's JavaScript; that verbatim text was not present in the static HTML retrieved via web fetch. The PR was approved by @dereknola, @manuelbuil, @galal-hussein, and @vitorsavian before merging. The quotes above are what was directly extractable.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
