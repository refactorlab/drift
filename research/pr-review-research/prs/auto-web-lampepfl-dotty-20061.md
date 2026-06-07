# lampepfl/dotty #20061 — Typeclass experiments refactored

**[View PR on GitHub](https://github.com/lampepfl/dotty/pull/20061)**

| | |
|---|---|
| **Author** | @odersky |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bmeesters
> I think `has` is a much better default than `is` if you look at popular type classes in Scala 2 today.

(Questioned whether the `is` syntax aligns with real-world library patterns like circe and akka that use `Decoder`, `Encoder`, etc.)

### @bjornregnell
> If we assume `tracked` for parameter `x`... then `foo` would get inferred type `Foo { val x: 1 }`.

(Raised questions about when the `tracked` modifier should be required versus inferred.)

### @sideeffffect
> Using `is` for this purpose would also be much more regular and thus easier for the newcomers to learn

(Proposed unifying context bounds syntax throughout instead of mixing with `:`.)

### @bjornregnell
> Multiple comments asking for explanations of syntax features like the "rocket" operator (`=>`) and why certain patterns must be illegal, indicating unclear documentation.

### @odersky
> Explained that `is` works as a linguistic analogy ("the Sky is blue") for type class characterization, distinguishing it from existing `Reader`-style classes that shouldn't adopt this syntax.

### @mbovel
> Noted that overriding deferred givens requires guessing generated names, suggesting the syntax creates usability friction despite clear naming rules.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
