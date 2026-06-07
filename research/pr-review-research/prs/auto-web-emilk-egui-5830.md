# emilk/egui #5830 — Add `AtomLayout`, abstracing layouting within widgets

**[View PR on GitHub](https://github.com/emilk/egui/pull/5830)**

| | |
|---|---|
| **Author** | @lucasmerlin |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @emilk
> Please run some benchmarks (the ones that are already there, and maybe some new ones more focused on e.g. just `Button`)

### @emilk
> Remember to run `cargo doc -p egui --open` and check the docs for the new top-level types. Some are missing, some are bad

### @emilk
> Does the label not contain more than just the text?

### @lucasmerlin
> The text now unfortunately contains the ⏵ from the submenu button...Maybe the Atomic could have a alt_text...This would also solve accessibility for Icon Fonts.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
