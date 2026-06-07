# bigskysoftware/htmx #2902 — Support multiple extended selectors for hx-include, hx-trigger from, and hx-disabled-elt

**[View PR on GitHub](https://github.com/bigskysoftware/htmx/pull/2902)**

| | |
|---|---|
| **Author** | @Telroshan |
| **Status** | Merged (December 12, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @1cg
> I'm fine w/ a loop-based mini-lexer, the logic isn't too brutal (basically count "<" and "/>") and ignore commas when count > 0)

### @MichaelWest22
> Checked test: my-version x 774,172 ops/sec ±7.65% (48 runs sampled) Checked test: telroshan-version x 676,418 ops/sec ±3.14%

### @MichaelWest22
> fun fact. unlike most languages there is no such thing as out of bounds array access error on strings

### @MichaelWest22
> Comment thread [src/htmx.js] Outdated Show resolved Hide resolved

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
