# mantinedev/mantine #8439 — [@mantine/modals] Enhance contextModal functions

**[View PR on GitHub](https://github.com/mantinedev/mantine/pull/8439)**

| | |
|---|---|
| **Author** | @AzzouQ |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @AzzouQ
> I'm unsure if you want to have that kind of logic inside the Provider of if you prefer to have it inside the reducer. But doing it in the reducer may require a new dispatch action for updateContext like 'UPDATE_CONTEXT'

### @AzzouQ
> This could also be unified to either remove or keep all mention of `Modal` at the end of each function. I left it like this because it would have require modifying files in demo, which was unecessary for the scope of this PR.

### @rtivital
> Please ignore the copilot review, I use it only for reference, if anything needs changing, I'll let you know.

### @Copilot AI
> The `closeContextModal` implementation has a potential issue: if the `modalKey` is not found, it falls back to using `modalKey` as the `modalId` directly. This fallback could mask errors where a modal is registered with one key but closed with a different key.

### @Copilot AI
> The `updateContextModal` function has a potential issue: when `modalId` is provided, it should be used directly without searching for the modal by `modalKey` [to prevent unintended fallback behavior].

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
