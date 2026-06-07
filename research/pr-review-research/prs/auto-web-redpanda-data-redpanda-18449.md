# redpanda-data/redpanda #18449 — Protobuf to Arrow converter

**[View PR on GitHub](https://github.com/redpanda-data/redpanda/pull/18449)**

| | |
|---|---|
| **Author** | @jcipar |
| **Status** | Merged |
| **Source** | GitHub conversation + files-changed pages (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @andrwng
> doesn't look like this is used anymore

(On the `field()` method — questioning whether it is still needed, since struct converters can return their arrow schemas directly.)

### @andrwng
> looks like this is/should only ever be called with a struct converter

(On `take_row_group()` — recommending it be moved from the interface to the struct-converter implementation only.)

### @andrwng
> Questioned whether the datalake library actually depends on `v::storage`, suggesting it might be unnecessary, and pointed out that a comment about chunk management should be revised, as `take_batch` isn't part of the interface (possibly meaning `finish_batch`).

### @dotnwat
> Requested using `vlog` instead of basic logging and emphasized the need for "contextual information useful in debugging" when reporting invalid protobuf field indices.

### @dotnwat
> Suggested that `take_row_group()` should be r-value qualified.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
