# ratatui-org/ratatui #783 — feat: Add `Constraint::Fixed(x)` and `Constraint::Proportional(x)`

**[View PR on GitHub](https://github.com/ratatui-org/ratatui/pull/783)**

| | |
|---|---|
| **Author** | @kdheepak |
| **Status** | Merged (January 13, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @joshka
> (Raised concerns about constraint priority ordering, asking "what would the expected result be?" for complex scenarios like `[Min(20), Length(79)]` when the terminal resizes to 50 width, noting potential undesirable behaviors with the proposed implementation.)

### @kdheepak
> (Explained that `Length`, `Percentage`, and `Ratio` currently have identical weights, making them functionally redundant; the new `Fixed` variant would enable predictable layout behaviors impossible with existing constraints, particularly for table column spacing.)

### @joshka
> (Questioned the necessity of `Eq` and `Hash` trait implementations for `Proportional`, asking about real use cases and whether users actually need to store constraints in `HashMap` or compare widgets for equality.)

### @kdheepak
> (Justified the implementation by noting that while exposing `f64` values would theoretically improve precision, the final rendered result is still constrained to `u16` values, making precise fractional values practically meaningless in terminal layouts.)

### @joshka
> (Suggested extracting the constraint-to-cassowary-solver conversion logic into a dedicated method and proposed adding user-configurable priority weights, potentially through a `WeightedConstraint` wrapper type.)

### @kdheepak
> (Proposed that `Fixed` alone would solve most layout problems, with `Proportional` enabling relative sizing for elements like centered layouts without pre-calculation.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
