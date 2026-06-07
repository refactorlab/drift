# junegunn/fzf #4731 — fish: Completion script rewrite (SHIFT-TAB)

**[View PR on GitHub](https://github.com/junegunn/fzf/pull/4731)**

| | |
|---|---|
| **Author** | @bitraid |
| **Status** | Merged (April 2, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @junegunn
> It looks like this change breaks backward compatibility for the custom completion API, right? Could you explain the rationale behind it?

### @junegunn
> The earlier work aimed to keep the API consistent with other shell implementations, which I thought was a strong design choice.

### @junegunn
> Make v3.4.0 the minimum required version for both scripts and simplify the code of key-bindings.fish.

### @junegunn
> The description part is no longer dimmed. Is this intended? To be clear, I don't have a strong opinion on the style.

### @bitraid
> The intention is for the descriptions to be searchable (and unless there is an option that I'm not aware of, it is not possible to dim the field)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
