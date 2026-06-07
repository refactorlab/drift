# paradigmxyz/reth #6222 — Sanitise eth68 announcement

**[View PR on GitHub](https://github.com/paradigmxyz/reth/pull/6222)**

| | |
|---|---|
| **Author** | @emhane |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mattsse
> This mixes rlp and validation. this is a lot of added complexity based on size assumptions. what's the benefit this gives us?

### @mattsse
> perhaps this would be more appropriate as a configurable setting inside the Transactionmanager/fetcher?

### @mattsse
> this is very easy to follow. now we need some good thresholds

### @Rjected
> LGTM, pending the nitpick comments I left, I like the validation trait!

### @mattsse
> I like this trait a lot! last nit re upper bound, then send it

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
