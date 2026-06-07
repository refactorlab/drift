# BerriAI/litellm #28868 — feat(context_management): compact_20260112 polyfill for non-Anthropic providers

**[View PR on GitHub](https://github.com/BerriAI/litellm/pull/28868)**

| | |
|---|---|
| **Author** | @Sameerlite |
| **Status** | Merged (May 30, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @veria-ai (security concern about rate-limit enforcement)
> read_only=True only observes the current counters; it does not increment RPM or reserve TPM the way the normal proxy pre-call limiter does.

(Flagged that the summary-model subrequest wasn't fully reserving capacity before execution.)

### @mateo-berri (rebuttal defending the design)
> deployment-level RPM/TPM is hard-enforced for every summary call...by the router's deployment pre-call checks...So a caller cannot drive completions past the summary model's configured RPM/TPM

(Argued that deployment limits and 1:1 request parity prevent actual bypass risk.)

### @greptile-apps (high-level safety assessment)
> Safe to merge; the polyfill is opt-in and all error paths degrade gracefully without affecting the main request.

### @cursor (autofix summary after Phase D corrections)
> Fixed: Wrong message source for post-compaction user question selection...so already-summarized turns can't be re-selected.

(Highlighted a context-loss bug where the polyfill was discarding recent conversation history after prior compaction.)

### @mateo-berri (approval after rate-limit defense)
> LGTM; thanks!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
