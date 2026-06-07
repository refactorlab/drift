# appwrite/appwrite #11886 — Presence api

**[View PR on GitHub](https://github.com/appwrite/appwrite/pull/11886)**

| | |
|---|---|
| **Author** | @ArnabChatterjee20k |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ArnabChatterjee20k
> Its intended. If staleness comes, server api can use the delete to delete the stale presences

### @ArnabChatterjee20k
> those are the expired events…Prolly later on we can have an expired presence channel and event

### @ArnabChatterjee20k
> we are not forcing server side to provide userId everytime but if its provided, it must be the server side

### @greptile-apps
> Requiring `userId` on every PATCH is unnecessarily restrictive…Consider removing the mandatory `userId` check from the update endpoint

### @greptile-apps
> If a pod crashes…there is no startup orphan sweep. Any user whose connection was on that pod will appear 'online' for up to 30 days

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
