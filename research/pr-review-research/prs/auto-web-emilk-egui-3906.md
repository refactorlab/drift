# emilk/egui #3906 — Add layer transforms, interaction in layer

**[View PR on GitHub](https://github.com/emilk/egui/pull/3906)**

| | |
|---|---|
| **Author** | @Tweoss |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @emilk
> Port TSTransform to emath, make transform persist

### @emilk
> switching the transform order

### @MeGaGiGaGon
> The two other biggest annoyances I've seen are that remain are the internal `Area`s not moving with the outer `Window`'s movement, and the layering issues

### @MeGaGiGaGon
> Areas.order is private

(suggested either exposing it or adding `Context::move_to_bottom` as alternatives for controlling layer ordering)

### @emilk
> The layering issue is difficult, and I think should be fixed in a separate PR

### @Dampfwalze
> `set_transform_layer` messes up text selection

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
