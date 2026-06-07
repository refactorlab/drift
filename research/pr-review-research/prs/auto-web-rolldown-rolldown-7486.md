# rolldown/rolldown #7486 — feat: optimize dynamic entry facade chunks by merging with common chunks when they are captured by common chunks

**[View PR on GitHub](https://github.com/rolldown/rolldown/pull/7486)**

| | |
|---|---|
| **Author** | @IWANABETHATGUY |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sapphi-red
> I wonder if we can reuse the optimization for `preserveEntrySignature: 'allow-extension'` by treating all dynamic imports to have `preserveEntrySignature: 'allow-extension'`.

### @Copilot
> Consider whether `optimize_facade_dynamic_entry_chunks` could be refactored to take only the necessary mutable parts as parameters rather than requiring `&mut self`.

### @sapphi-red
> (Flagged multiple outdated sections requesting clarification on implementation details in chunk optimization logic and namespace symbol handling.)

### @sapphi-red
> (Questioned the approach to skipping module inclusion when only tracking namespace symbols in the `SimulatedFacadeChunk` case.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
