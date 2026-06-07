# grafana/tempo #5213 — [DOC] Add tail sampling policy doc

**[View PR on GitHub](https://github.com/grafana/tempo/pull/5213)**

| | |
|---|---|
| **Author** | @knylander-grafana |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mattdurham
> One thing I did not see and it might be out of scope is usage of the `loadbalancing` component that is critical when running tail sampling at scale.

### @ayah-el
> We have this existing doc that we can reference: https://grafana.com/docs/alloy/latest/reference/components/otelcol/otelcol.exporter.loadbalancing/

### @mattdurham
> Went through spot checked some of the alloy configs. Looks good from my end, fantastic work. Tail sampling is one of the more complex bits!

### @mattdurham
> Tagging @clayton-cornell if this should be shared/stolen for alloy docs.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
