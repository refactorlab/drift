# dart-lang/sdk #28176 — Informal proposal for covariant overrides.

**[View PR on GitHub](https://github.com/dart-lang/sdk/pull/28176)**

| | |
|---|---|
| **Author** | @munificent |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lrhn
> we probably don't want to allow omitting the type after 'covariant'

(Proposed requiring explicit type specification to prevent ambiguity in parsing.)

### @bwilkerson
> If `covariant` is neither a keyword nor a built-in identifier, then it can also be used as a type name

(Questioned how function signatures should be interpreted given this ambiguity.)

### @bwilkerson
> the way the production `normalFormalParameter` is written the `covariant` keyword comes before the metadata for the parameter. I assume that isn't the intent.

### @lrhn
> can only be applied to a formal parameter on an instance method... or to a non-final instance field.

(Suggested replacing awkward phrasing about where `covariant` applies.)

### @eernstg
> Resolved ambiguity by making `covariant` a built-in identifier and creating a separate `functionFormalParameter` grammar rule to handle function-typed parameters properly.

### @lrhn
> Just use the actual return type

(For overrides rather than computing least upper bounds, simplifying the specification significantly.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
