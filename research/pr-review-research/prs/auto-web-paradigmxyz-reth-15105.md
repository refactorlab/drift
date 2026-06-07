# paradigmxyz/reth #15105 — Implement txpool interop support for optimism

**[View PR on GitHub](https://github.com/paradigmxyz/reth/pull/15105)**

| | |
|---|---|
| **Author** | @SozinM |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mattsse
> I believe this setup is problematic, because this doesn't account for when interop will be activated and only check the current local head block, which will always be false if a fresh node is started. we need to track activation dynamically

### @mattsse
> all this type does is send one single request...imo we can do all of this without pulling in the kona client dependency here

### @mattsse
> this error should be converted into a standalone error struct that then also implements `PoolTransactionError` this way we don't need this additional error variant

### @emhane
> ye, this is an op specific error, so it doesn't make sense here

### @SozinM
> Couple of questions...Are we okay introducing something like 'first seen' for transaction in txpool?

### @emhane
> imo we can do the first seen, expire validity after 24h, in a follow up pr. let's get the base running first.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
