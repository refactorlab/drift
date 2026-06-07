# flutter/flutter #143249 — Autocomplete Options Width

**[View PR on GitHub](https://github.com/flutter/flutter/pull/143249)**

| | |
|---|---|
| **Author** | @justinmc |
| **Status** | ✅ merged (2025-01-14) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Argue from user expectation and *ownership*: the widget itself should own width-matching because that's what users expect. Then stress the layout-constraint corners (resize-while-open).

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@gnprice:**
> I think it'd be best for width-matching to be the default, though, because that's the behavior most people will expect... It definitely feels to me like the kind of detail I'd expect the autocomplete widget itself to have responsibility for.

**@LongCatIsLooong:**
> I think the layout builder is probably still needed. If the text field gets a set of different input constraints, then this variable is going to change, but nothing is telling the menu to resize if it's already open?

**@wmadden:**
> You can use the existing fieldKey to get the RenderBox of the text field and use that to size the options list widget... You don't need the postframe callback, which should simplify the tests


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
