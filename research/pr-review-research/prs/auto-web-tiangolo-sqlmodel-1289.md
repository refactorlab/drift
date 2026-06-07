# tiangolo/sqlmodel #1289 — ⬆️ Add support for Python 3.13

**[View PR on GitHub](https://github.com/tiangolo/sqlmodel/pull/1289)**

| | |
|---|---|
| **Author** | @svlandeg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tiangolo
> I'm pretty sure the problem is that Pydantic has it defined as a `dict[str, pydantic.fields.FieldInfo]` and `dict` doesn't support subclasses of the parameters defined (the erudite term is "invariant" I think 😅, `dict` is invariant).

### @tiangolo
> I would say we can add a type ignore and later in another PR add the types, just to save the autocompletion there, not sure how useful and used it is, but maybe.

### @tiangolo
> If dropping support for Python 3.7 would have made this easier, I would have definitely accepted it, just so you know you don't have to battle it so hard.

### @svlandeg
> The most time was spent on actually figuring out WHY `uv`'s dependency resolution tracked back to such an old version of Pydantic. Once I found out that the `typing-extensions` pin was the culprit, the fix was actually an easy one.

### @tiangolo
> we expect people to use `sqlmodel.Field` instead of `pydantic.Field`, so we would always have our own custom `FieldInfo` there.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
