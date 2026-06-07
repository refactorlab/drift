# derailed/k9s #2799 — feat(app): add history navigation with `[` and `]`, most recent command with `-`

**[View PR on GitHub](https://github.com/derailed/k9s/pull/2799)**

| | |
|---|---|
| **Author** | @tyzbit |
| **Status** | Merged (February 16, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @KevinGimbel
> When I look at containers (Select Pod -> Enter) I cannot go back to the pods with `-` or `b`. Same when using Describe (`d`). Is this intended?

### @derailed
> Nice work! Good concept. Just a few items to clean up and simplify.

### @KevinGimbel
> I think that's a good idea, just to make it clear what to expect from the feature

### @KevinGimbel
> Your commit changed all `*` to `-` for lists - I assume some plugin or editor configuration on your side is making these changes?

### @saiskee
> Can we add the history navigation keys to the 'Help' screen?

### @merusso
> Looks good to me now. @derailed in my opinion this could be added to the next released :)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
