# ray-project/ray #56838 — [RLlib] MetricsLogger tweaks+ Stats rewrite

**[View PR on GitHub](https://github.com/ray-project/ray/pull/56838)**

| | |
|---|---|
| **Author** | @ArturNiederfahrenhorst |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kamil-kaczmarek
> Great work @ArturNiederfahrenhorst! Will you PR address any of these?:

### @kamil-kaczmarek
> @ArturNiederfahrenhorst while testing keep an eye on the potential CPU or memory pressure.

### @simonsays1980
> Afaiu this would then not allow out-of-the-box one of our customers to collect raw values from EnvRunners and then aggregate across all of them in `aggregate` via 'mean'? The customer would need to customize somehow the `MeanStats`?

### @simonsays1980
> Why don't we need these metrics anymore?

### @simonsays1980
> Does the `reduce` method not have anymore the `is_root` attribute?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
