# Farama-Foundation/Gymnasium #889 — Made readout of seed possible in env

**[View PR on GitHub](https://github.com/Farama-Foundation/Gymnasium/pull/889)**

| | |
|---|---|
| **Author** | @MischaPanch |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pseudo-rnd-thoughts
> Does it make sense to change the name to make it more explicit? i.e., `_np_random_seed`? As `seed` feels like a common variable name that we don't want to be accidentally writing over

### @pseudo-rnd-thoughts
> There use to be an important function called `seed` was removed. This is why the tests are failing Therefore, could you change all relevant parts to `_np_random_seed` and `np_random_seed`

### @MischaPanch
> Even if you consider the particular use case of evaluation protocols irrelevant, it's unusual that something user-provided cannot be read off at all after being set.

### @pseudo-rnd-thoughts
> For example Atari, have second random number generators (internal to the games) that cannot be accessed. Therefore, knowing the `np_random` generator seed is not helpful

### @RedTachyon
> Not sure if this is a good idea to expose, since it will (I think) be a copy of the generator, not the same object.

### @pseudo-rnd-thoughts
> RedTachyon has brought up good points to consider but I don't view any as major that prevent this PR being merged.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
