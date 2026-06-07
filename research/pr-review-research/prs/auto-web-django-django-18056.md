# django/django #18056 — Fixed #373 -- Added CompositePrimaryKey.

**[View PR on GitHub](https://github.com/django/django/pull/18056)**

| | |
|---|---|
| **Author** | @csirmazbendeguz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @LilyFirefly
> The main issue I have with them is that they're written for specific databases instead of for generic database features...the asserts of the actual SQL might be a bit tricky to adapt

### @charettes
> Something that came through my mind while reviewing is that we likely want a plan to eventually deprecate `Options.pk` in favor of `Options.primary_key`?

### @timgraham
> I see nothing about whether or not this field is supported in forms...What happens if you try to use such a model in forms, formsets, etc.

### @LilyFirefly
> We can probably raise an error if this isn't the case - maybe using the checks framework.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
