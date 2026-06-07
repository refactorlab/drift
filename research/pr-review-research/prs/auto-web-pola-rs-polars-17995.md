# pola-rs/polars #17995 — feat(python!): Use Altair in DataFrame.plot

**[View PR on GitHub](https://github.com/pola-rs/polars/pull/17995)**

| | |
|---|---|
| **Author** | @MarcoGorelli |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @binste
> However, if you fully want to mirror the type hints in altair with all altair-specific classes, I think we could expose those. Maybe something like `altair.typing.XChannelType`...

### @mattijn
> There have been requests to introduce methods in Altair that could be used in other packages but had no usage within Altair itself. This approach should be avoided here as well.

### @dangotbanned
> I think this approach would work better if `Plot` (or a version of) were a `Protocol`, that `altair` and any other library could handle the implementation of.

### @MarcoGorelli
> I think the fully-customisable backends part is becoming too complex too quickly...start with Altair, keep plotting marked as unstable...if/when other plotting libraries reach this level, we discuss a more pluggable solution.

### @joelostblom
> The advantage of `DataFrame.plot` being a really thin layer is that moving between the two should be easy...users could do something like `df.plot.line(x='date', y='price').configure_axis(grid=False)`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
