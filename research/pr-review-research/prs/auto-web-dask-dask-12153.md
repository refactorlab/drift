# dask/dask #12153 — Support zarr sharding through create_array

**[View PR on GitHub](https://github.com/dask/dask/pull/12153)**

| | |
|---|---|
| **Author** | @melonora |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @d-v-b
> it might be easier to copy the signature for `create_array` as much as possible, which would argue for having `chunks` and `shards` parameters, both of which could default to `"auto"`.

### @dcherian
> In Xarray, this escape hatch is the 'encoding' kwarg which is passed directly to the storage backed (Zarr in this case). I wonder if a similar `zarr_kwargs` is better. anything in there gets forwarded to the user.

### @d-v-b
> if we go with something like `zarr_kwargs`, we could model `zarr_kwargs` as a typeddict version of the `create_array` signature. Sticking with whatever zarr-python is doing under the hood seems like a better approach than creating new parameters.

### @jacobtomlinson
> It feels like the API design discussion has run it's course here. If @d-v-b or @dcherian have any more feedback it can happen in a follow up PR.

### @TomAugspurger
> Looks good at a glance, thanks. Just a couple small questions.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
