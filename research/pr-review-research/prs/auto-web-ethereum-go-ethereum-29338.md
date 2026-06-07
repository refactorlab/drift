# ethereum/go-ethereum #29338 — cmd, core, params, trie: add verkle access witness gas charging

**[View PR on GitHub](https://github.com/ethereum/go-ethereum/pull/29338)**

| | |
|---|---|
| **Author** | @gballet |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @holiman
> you do e.g. `BalanceGas`, which does two things: (1) Adds it to the access events (2) Returns how much it cost... the evm cannot first check if the cost is covered, and then proceed (or not).

### @holiman
> we've added `N` slots to the witness, bloating it, at the cost of `~100`... whereas the 'true' cost would have been something like `N x ((WitnessBranchReadCost @ 1900) + (WitnessChunkReadCost @ 200))`

### @rjl493456442
> As account fields are stored in different position in leafNode... gas metering could be wrong very easy.

### @holiman
> I'd prefer if you make `opExtCodeCopyVerkle` and put in `eips`. That way we _know_ that the verkle-things do not interfere.

### @gballet
> it's not great, because if any operation is changed between the time I copy the code and the time the Osaka fork is activated, there is a regression risk.

### @rjl493456442
> I think it should be safe to merge without affecting existing non-verkle part logic... might need to be iterated a few rounds.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
