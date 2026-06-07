# zed-industries/zed #26893 — editor: Add minimap

**[View PR on GitHub](https://github.com/zed-industries/zed/pull/26893)**

| | |
|---|---|
| **Author** | @esimkowitz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SomeoneToIgnore
> Can you elaborate on the performance issues you observe? Overall, the last big missing piece of functionality is mouse click handlers, what do you think?

### @SomeoneToIgnore
> There's a bug causing the minimap to bounce off the edge... While noted in the PR description, I'd like to emphasize for the bright themes, how now would be to have a background/border to visually separate minimap from the rest of the text.

### @esimkowitz
> I think the performance implication with scrolling that I was noticing was actually just a standard degradation of the debug environment vs the release environment

### @esimkowitz
> Thankfully the bouncing issue was simple to fix, I was using `window.with_absolute_element_offset` when I should have used `window.with_element_offset`

### @esimkowitz
> I'm noticing that even though I'm using the scrollbar bounds as the basis for the minimap bounds, sometimes the height is off.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
