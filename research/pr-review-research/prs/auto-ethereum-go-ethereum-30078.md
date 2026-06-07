# ethereum/go-ethereum #30078 — all: implement eip-7702 set code tx

**[View PR on GitHub](https://github.com/ethereum/go-ethereum/pull/30078)**

| | |
|---|---|
| **Author** | @lightclient |
| **Status** | ✅ merged |
| **Opened** | 2024-06-26 |
| **Repo importance** | ★51,093 · 21,927 forks · score 143,783 |
| **Diff** | +1606 / −115 across 66 files |
| **Engagement** | 36 conversation · 135 inline review comments |

## Top review comments (ranked by reactions)

### @holiman — 2 reactions  
`👍 2`  ·  [link](https://github.com/ethereum/go-ethereum/pull/30078#issuecomment-2415869957)

> Reading up on the spec, I typed up some questions. Maybe this should have been posted in a different forum
> 
> ------------------
> 
> ### Nonce bumps 
> 
> > After incrementing the sender’s nonce
> 
> So, if my auth's are
>  
> Prestate: `Addr X: nonce 5`
> tx (nonce: `5`, addr `X`)
> 
> - auth1: `auth X`, nonce `6`, address `Y`
> - auth2: `auth X`, nonce `7`, address `Z`
> - auth3: `auth X`, nonce `8`, address `Y`
> 
> Would result in `Addr X: nonce 8` delegated to code @ `Y`. So nonce for `X` goes from `5` to `8` with this tx, correct?
> 
> EDIT: Yes, correct
> 
> -------------------
> 
> ### Dos-ability
> 
> How large can we make a transaction, and how costly is it to validate? 
> I.e, how many signature recoveries, if we assume that the final `auth` invalidates the transaction?
> THe `PER_AUTH_BASE_COST` of `12500` is only paid for valid transactions. Perhaps we should specify a 
> max "risk appetite" that geth is willing to spend. If the tx is more expensive than, e.g. `200K` gas, 
> then it might be a DoS and not worth the risk of validating (and thus discard)?
> 
> ---------------
> 
> ### Delegate of delegate of delegate
> 
> - auth1: `auth X`, address `Y`
>   - This sets `X` code to `0xef0100 || Y`
> - auth2: `auth Z`, address `X`
>   - This sets `Z` to `0xef0100 || X`
> 
> What happens when we execute code at `Z`? Do we resolve it `N` steps until we reach a final non-delegation? 
> Are there tests for this? 
> 
> ### Recursive delegation
> 
> - auth1: `auth X`, address `Y`
>   - This sets `X` code to `0xef0100 || Y`
> - auth2: `auth Y`, address `X`
>   - This sets `Y` to `0xef0100 || X`
> 
> What happens when we execute code at either `X` or `Y`? If we follow … *[truncated]*

### @lightclient — 1 reactions  
`👍 1`  ·  [link](https://github.com/ethereum/go-ethereum/pull/30078#issuecomment-2444610142)

> > One question I had is whether eth_getCode and eth_getProof should resolve the delegation or not, I presume they should not (as it is right now) but I would like to confirm.
> 
> I think they should not resolve the code.

### @holiman — 1 reactions  
`👍 1`  ·  [link](https://github.com/ethereum/go-ethereum/pull/30078#issuecomment-2500896821)

> Should we add the new tx type here? 
> `accounts/external/backend.go`:
> ```
> 	switch tx.Type() {
> 	case types.LegacyTxType, types.AccessListTxType:
> 		args.GasPrice = (*hexutil.Big)(tx.GasPrice())
> 	case types.DynamicFeeTxType, types.BlobTxType:
> 		args.MaxFeePerGas = (*hexutil.Big)(tx.GasFeeCap())
> 		args.MaxPriorityFeePerGas = (*hexutil.Big)(tx.GasTipCap())
> 	default:
> 		return nil, fmt.Errorf("unsupported tx type %d", tx.Type())
> 	}
> ```
> `transaction_args.go`
> ```
> unc (args *TransactionArgs) ToTransaction(defaultType int) *types.Transaction {
> 	usedType := types.LegacyTxType
> 	switch {
> 	case args.BlobHashes != nil || defaultType == types.BlobTxType:
> 		usedType = types.BlobTxType
> 	case args.MaxFeePerGas != nil || defaultType == types.DynamicFeeTxType:
> 		usedType = types.DynamicFeeTxType
> 	case args.AccessList != nil || defaultType == types.AccessListTxType:
> 		usedType = types.AccessListTxType
> 	}
> ```
> ?

### @lightclient — 1 reactions  
`👍 1`  ·  [link](https://github.com/ethereum/go-ethereum/pull/30078#issuecomment-2521486812)

> > So, @rjl493456442 raised some very good points (well spotted!), re a sentence in the eip:
> 
> > >    all code executing operations to follow the address pointer to get the account’s executable code, and requires all other code reading operations to act only on the first 2 bytes of the designator
> 
> Yes this is correct, currently the latest version of the EIP targets this. However, the PR targets the previous devnet-4 version of the EIP as specified https://github.com/ethereum/EIPs/blob/a7fb2260ae2ea39bdd31886832c9e45452d0e76a/EIPS/eip-7702.md.
> 
> Depending on when we plan to merge this, I think it is probably better to merge as-is because we can run this PR against the devnet-4 spec tests to ensure correctness. It will be pretty straightforward update when we make the devnet-5 changes.
> 
> Let me know if you feel strongly about directly targeting devnet-5 and I can update the PR.

### @holiman — 1 reactions  
`👍 1`  ·  [link](https://github.com/ethereum/go-ethereum/pull/30078#issuecomment-2538327068)

> This PR just blindly overwrites the cancun definition. It doesn't use a prague jumptable. 
> 
> ```golang
> // NewEVMInterpreter returns a new instance of the Interpreter.
> func NewEVMInterpreter(evm *EVM) *EVMInterpreter {
> 	// If jump table was not initialised we set the default one.
> 	var table *JumpTable
> 	switch {
> 	case evm.chainRules.IsVerkle:
> 		// TODO replace with proper instruction set when fork is specified
> 		table = &verkleInstructionSet
> 	case evm.chainRules.IsCancun:
> 		table = &cancunInstructionSet
> ```
> ~~I was very close to merging this, it would have consensus-borked master. Not great.~~
> 
> EDIT: @fjl pointed out that this might actually work fine on cancun, as there are no delegations. It's still wrong though... I'm going to put it up on bench05 to sanity-check. 
> 
> EDIT2: It's been running for a few hours now -- seems to work fine with EIP7702-ops activated!

### @rjl493456442 — 0 reactions  
`—`  ·  [link](https://github.com/ethereum/go-ethereum/pull/30078#issuecomment-2193876428)

> Should we propose another EIP to revamp EIP158? Otherwise, as we discussed previously, the leftover storage of an "empty" EOA could be cleared at the end of block.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
