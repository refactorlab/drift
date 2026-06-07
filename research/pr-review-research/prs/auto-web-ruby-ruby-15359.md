# ruby/ruby #15359 — ZJIT: Create HIR effect system

**[View PR on GitHub](https://github.com/ruby/ruby/pull/15359)**

| | |
|---|---|
| **Author** | @jacob-shops |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @k0kubun
> Where will we use this first? Would it be a too-large diff to use `effects_of` somewhere?...Landing the infrastructure early seems fine, but once you merge the all-`effects::Any` version, we may not have a next opportunity to review each of these instructions, leaving some instructions as `Any` forever.

### @tekknolagi
> I think overall `Effects::read_write` or `write_read` (vs `from_sets`...which set is which) and `Effects::read(...)` and `write()` are probably easier names to remember and reason about. Also can we replace EffectSet* globally with AbstractHeap*?

### @jacob-shops
> These are great ideas. I will try to come up with a small lift to use `effects_of` somewhere...or by taking a look at things like the `no_gc` or `leaf` booleans in VM properties.

### @k0kubun
> I asked a question about `AbstractHeap`, but overall it looks like a nice patch to introduce effects 👍

### @tekknolagi
> let's merge

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
