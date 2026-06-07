# yewstack/yew #4033 — fix: yield when 16ms has passed and no dom mutating tasks are pending

**[View PR on GitHub](https://github.com/yewstack/yew/pull/4033)**

| | |
|---|---|
| **Author** | @Madoshakalaka |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @WorldSEnder
> DOM may be partially updated when the browser paints during a yield...yielding at an arbitrary point between updating a component and its children...means there could be an event handling interrupting it.

### @WorldSEnder
> The event handling part is currently unaware of this intermediate state and will run arbitrary used code that might interact with DOM at that point.

### @Madoshakalaka
> Yield to the browser only when no DOM-mutating work (destroy, create, render_first, render, render_priority) is pending, so event handlers that fire during the yield never see a partially-rendered tree.

### @WorldSEnder
> Sounds good to me. Any specific reason to use 50ms here, btw? I'd expected something close to either 30 or 60 fps...but that's just a first naive thought.

### @Madoshakalaka
> 33ms or 16ms makes more sense I think

### @WorldSEnder
> Isn't the issue that the test is wrong and expects everything to be settled after sleep(0)?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
