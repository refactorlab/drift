# BerriAI/litellm #26590 — [Feat] Add tool calling support for gemini and vertex ai live api

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/26590)**

| | |
|---|---|
| **Author** | @Sameerlite |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: This PR's conversation thread was dominated by automated reviewers (Greptile, Cursor Bugbot). Human discussion was sparse. The substantive design and bug-fix points below are drawn from the visible human comments and the bot autofix previews that the contributors acted on.

### @Sameerlite
> This PR has become messy, will raise another one

(Apr 27 — indicating dissatisfaction with the branch's state during development.)

### @mateo-berri
Repeatedly invoked `@greptileai` for review (May 23, multiple instances), relying on automated analysis to drive the review.

### Cursor Bugbot (issues the contributors addressed)
> Missing `event_id` on response events

### Cursor Bugbot (issues the contributors addressed)
> Shared mutable dict corruption across tool-call events

### Cursor Bugbot (issues the contributors addressed)
> Type-safety guards needed for non-dict payloads

### Cursor Bugbot (issues the contributors addressed)
> Proper ordering of guardrail messages relative to tool responses

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
