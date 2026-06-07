# astral-sh/ruff #22291 — [ty] Add support for dynamic `type()` classes

**[View PR on GitHub](https://github.com/astral-sh/ruff/pull/22291)**

| | |
|---|---|
| **Author** | @charliermarsh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @AlexWaygood
> I haven't looked too hard at this yet, but is adding a new `Type` variant definitely the best way of doing this? We've talked in the past about making `ClassLiteral` (the wrapped data inside the `Type::ClassLiteral` variant) an enum.

### @AlexWaygood
> We should also try to make our design here extensible for other classes-created-by-function-calls: functional namedtuples, functional typeddicts, and functional enums.

### @carljm
> I think you're using `SubsequentMroElements::Owned()` more than you need to -- you could [simplify this] and the fallback isn't stored on the error returned.

### @AlexWaygood
> We should also emit a diagnostic if you try to use an `@final` class as the base class for a dynamic class, e.g. `type('X', (Base,), {})`

### @AlexWaygood
> This looks very good, and I think it's close! My main comment on this pass is I think we could do with a bunch more tests

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
