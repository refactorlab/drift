# ethereum/go-ethereum #30643 — triedb/pathdb: track flat state changes in pathdb (snapshot integration pt 2)

**[View PR on GitHub](https://github.com/ethereum/go-ethereum/pull/30643)**

| | |
|---|---|
| **Author** | @rjl493456442 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @holiman
> We typically do not use rlp like this, encoding four times with this type of manual steps. How come you don't use something more auto-generated? Is there some optimization at play here?

### @holiman
> Wouldn't it make sense to define a `stateSetMarshalling` type then? And, in this encode method, conver the fields to the `stateSetMarshalling` and then just rlp-encode that struct?

### @holiman
> You do not use the readlock in these methods. Do you assume that the caller handles the readlocking? If so, it seems pretty inconsistent.

### @holiman
> But some changes were not already flushed to that nodereader. Does that matter? Or are those two separate things?

### @MariusVanDerWijden
> So previously an empty blob would result in slots[hash] = nil, while it will be []byte now. I'm pretty sure its okay, but I just wanted to double check

### @will-2012
> If without bloomfilter, will it cause negative impact on performance?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
