# pallets/flask #5736 — support call template_filter without parens

**[View PR on GitHub](https://github.com/pallets/flask/pull/5736)**

| | |
|---|---|
| **Author** | @kadai0308 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kadai0308
> I considered the following implementation options: 1. Rename the input parameter to func_or_name to better reflect the logic of how the input is interpreted... However, this would be a breaking change for calls like @app.template_filter(name="..."), so I decided to keep the original parameter name for backward compatibility.

### @kadai0308
> Make func_or_name a positional-only parameter and keep name as keyword-only... This approach is type-safe, but it introduces the awkward case where both func_or_name and name are provided at the same time.

### @davidism
> You're fine, this is the direction I want to go and you were first anyway.

### @davidism
> Thanks for working on this, you were really through with the typing, docs, and tests... I ended up pushing another commit that rewrote the docs entirely, used the callable types consistently, and made the code a bit more concise.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
