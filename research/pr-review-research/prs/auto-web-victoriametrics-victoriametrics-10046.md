# VictoriaMetrics/VictoriaMetrics #10046 — app/vmalert: add `group_limit` and `page_num` for pagination and `search` for search at /api/v1/rules

**[View PR on GitHub](https://github.com/VictoriaMetrics/VictoriaMetrics/pull/10046)**

| | |
|---|---|
| **Author** | @AndrewChubatiuk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Haleygo
> We did not follow the prometheus rule API parameter `group_next_token`, as we believe pagination using `page_num` provides a clearer experience for users and simplifies tasks such as handling updated groups and sharing links.

### @AndrewChubatiuk
> these fields were added for old VMAlert UI. they were unintentionally exposed in API before

### @AndrewChubatiuk
> it should not affect prometheus compatibility as it updates rule states only if `extended_states=true` query argument is passed

### @Haleygo
> This pull request introduces a pagination feature to the VMUI Alerting page, which should significantly improve performance for users reviewing thousands of rules.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
