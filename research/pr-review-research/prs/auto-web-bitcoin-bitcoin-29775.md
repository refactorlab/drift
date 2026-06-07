# bitcoin/bitcoin #29775 — Testnet4 including PoW difficulty adjustment fix

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/29775)**

| | |
|---|---|
| **Author** | @fjahr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @maflcko
> When resetting a test chain, it is also important to consider the script interpreter coverage of the current chain...testnet is the only public chain where anyone can submit a nonstandard transaction from their laptop.

### @luke-jr
> This seems too complicated for a testnet exception IMO. And it breaks the use case of someone testing being able to mine a block on-demand without actual mining hardware. Shouldn't it be enough to just fix the timewarp bug?

### @murchandamus
> Since some people consider the blockstorms an interesting feature of Testnet3, it might be interesting to only raise the difficulty...to 100,000 instead of 1,000,000.

### @darosior
> It's OK in this specific case...since this is a new network...However for a patch to an existing network, we should consider something akin to what Matt did in #15482 for the 64 bytes txs check.

### @zawy12
> preventing nActualtimespan from going negative could stop my attack...An alternate fix...no block to be more than 2 hours and 80 minutes before its parent block.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
