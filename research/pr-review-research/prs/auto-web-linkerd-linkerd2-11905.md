# linkerd/linkerd2 #11905 — Introduce new external endpoints controller

**[View PR on GitHub](https://github.com/linkerd/linkerd2/pull/11905)**

| | |
|---|---|
| **Author** | @mateiidavid |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zaharidichev
> Update now adds filtering to callbacks, including typecasts and a more comprehensive filter for which ExternalWorkload to update based on the spec changes.

### @zaharidichev
> This diffing logic is always quite error-prone. This is why I think you need to rely on more isolated tests like the one I provided in the comments. This should make it easier to think through and verify stuff.

### @zaharidichev
> Also, it would be good you can provide some functional testing instructions for this change so anyone can try it out themselves.

### @adleong
> It may be worth noting in a comment that this is structurally based on kubernetes/kubernetes...and perhaps even noting cases where they significantly differ (if any).

> **Note:** @adleong (Jan 10) also requested multiple clarifications on error handling and queue management — concerns about how the controller processes workload updates and handles edge cases in reconciliation logic — but the verbatim text of those individual inline threads was not web-retrievable.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
