# ethereum/go-ethereum #30078 — all: implement eip-7702 set code tx

**[View PR on GitHub](https://github.com/ethereum/go-ethereum/pull/30078)**

| | |
|---|---|
| **Author** | @lightclient |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rjl493456442
> Should we propose another EIP to revamp EIP158? Otherwise, as we discussed previously, the leftover storage of an 'empty' EOA could be cleared at the end of block.

### @lightclient
> I think the proposal which will get accepted for devnet-2 and on will avoid the 158 problem, so it's probably okay to just let it play out.

### @buddh0
> I noticed there are audits for EIP-2935... Are there similar audits for EIP-7702? Considering the significant changes it introduces to the EVM.

### @holiman
> Remaining appveyor failure is unrelated to this PR, afaict.

### @rjl493456442
> Multiple review rounds focused on gas calculation and dynamic operation handling in core/vm operations before final approval.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
