# pydantic/pydantic #9459 — Add pipeline API

**[View PR on GitHub](https://github.com/pydantic/pydantic/pull/9459)**

| | |
|---|---|
| **Author** | @adriangb |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @davidhewitt
> Two observations here: It feels pretty verbose to have this pipeline inline. Should we encourage users to make it reusable?

### @davidhewitt
> is it a significant ergonomic win to allow the argument to be inferred. Otherwise I might argue to make it required for now to simplify.

### @dmontagu
> I think I understand why this API was added — as long as the input and output types of a pipeline are the same, then it's basically equivalent to do them in order. However, I'll note that sequencing the items like this may end up being unintuitive.

### @sydney-runkle
> Do we want to call the file with this logic `transform.py` eventually? I feel like that might confuse some folks, it's a pretty hot word in the data science space.

### @davidhewitt
> Can you explain what this means? I assume that this is interactions with `BeforeValidator`. How do we implement wrap validators in this model?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
