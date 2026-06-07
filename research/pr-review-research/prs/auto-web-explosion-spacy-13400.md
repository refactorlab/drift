# explosion/spaCy #13400 — Fix use_gold_ents behaviour for EntityLinker

**[View PR on GitHub](https://github.com/explosion/spaCy/pull/13400)**

| | |
|---|---|
| **Author** | @svlandeg |
| **Status** | Merged (April 16, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rmitsch
> Can you elaborate on the cleaning up/restoration from reason 1.? Not sure what you mean by that.

### @svlandeg
> The entity linker was changing these examples by setting gold entities on the first 10 examples...and not cleaning up afterwards, leaving the examples in an inconsistent/wrong state.

### @rmitsch
> Hm, do we manipulate examples in other components? I'm also unsure about this. Either way 👍 for copying it.

### @svlandeg
> this whole bit is surely pretty hacky, but considering bug 3...I don't see a better option other than changing the entire mechanism.

### @rmitsch
> Agreed, this is not really satisfying. The workaround makes sense in this context though.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
