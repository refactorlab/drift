# meilisearch/meilisearch #6182 — Support dynamic search rules with pinning

**[View PR on GitHub](https://github.com/meilisearch/meilisearch/pull/6182)**

| | |
|---|---|
| **Author** | @YoEight |
| **Status** | Merged (March 26, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dureuill
> To have a minimal but complete iteration, I suggest we completely remove boosting, burying and hiding from the current PR.

### @dureuill
> I think we should inject the pinned documents by adding an enumerate to the iterator that builds final hit lists, rather than 'patching' them with `insert`

### @dureuill
> I suggest we write integration tests exercising these features at the same time: pinning and filters, multiple pinning rules enabled to see the action of priority

### @dureuill
> I wasn't exactly fan of this method for chats either, but i think we might have one order of magnitude fewer chat workspaces as rules

### @dureuill
> Due to the interaction of pinning with many features, I suggest we write integration tests exercising these features at the same time

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
