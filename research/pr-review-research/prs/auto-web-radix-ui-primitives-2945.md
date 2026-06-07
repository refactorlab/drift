# radix-ui/primitives #2945 — [ScrollArea] Viewport fixes

**[View PR on GitHub](https://github.com/radix-ui/primitives/pull/2945)**

| | |
|---|---|
| **Author** | @vladmoroz |
| **Status** | Merged (later reverted in 1.2.1 to fix a regression) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @vladmoroz
> This is a helper function that is used when a component supports `asChild` using the `Slot` component but its implementation contains nested DOM elements. Using it ensures if a consumer uses the `asChild` prop, the elements are in correct order in the DOM, adopting the intended consumer `children`.

### @kognise
> `width: min-content` on the inner container caused horizontal layouts inside vertical scroll areas to not be full width. For now we are doing: .rt-ScrollAreaViewport>\* { width: 100%; } but it doesn't seem very correct?

### @chaance
> Reverted in 1.2.1 to fix the regression. Will revisit this at a later date.

### @chaance
> I'm planning to come back to this but I think the splash radius here for breaking apps is a little too big to justify in a patch release. We'll either re-release it in a major or adjust it to avoid breakage.

### @Georgegriff
> The removal of display table in this pr fixed other things, such as being able to properly use flexbox to dynamically size the scroll height, was relying on it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
