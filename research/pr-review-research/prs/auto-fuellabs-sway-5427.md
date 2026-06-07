# FuelLabs/sway #5427 — New encoding for contract calls 

**[View PR on GitHub](https://github.com/FuelLabs/sway/pull/5427)**

| | |
|---|---|
| **Author** | @xunilrj |
| **Status** | ✅ merged |
| **Opened** | 2024-01-02 |
| **Repo importance** | ★61,652 · 5,423 forks · score 88,314 |
| **Diff** | +5584 / −1439 across 142 files |
| **Engagement** | 28 conversation · 60 inline review comments |

## Top review comments (ranked by reactions)

### @xunilrj — 1 reactions  
`👍 1`  ·  [link](https://github.com/FuelLabs/sway/pull/5427#issuecomment-1978551782)

> > Here is how I understand the change done to function generation: if the function is not compiler generated (!callee.span().as_str().is_empty()) generate the key and either get already compiled function by that key or create it and insert under that key. But if it is compiler generated, generate it every time it is called.
> 
> Correct.
> 
> > I guess this works for now because the functions generated for contracts calls, and also __entry are called only once. Still, looking into future and possible generation of functions for different purposes (thinking of storage right now), can we think of:
> > Adding is_compiler_generated() method to TyFunctionDecl and eventually think of other ways of determined if a function is compiler generated. E.g. in the compiler_generated.rs we used name prefixes to determine if variables are compiler generated.
> > Create a unique fn_key also for the compiler generated methods. I assume we will still have enough distinguished elements like e.g. unique names and the parameters and type parameters we will anyhow have.
> 
> Currently, in the case of a generated function is called multiple times we will depend on the `dedup` optimization to avoid code bloat.
> 
> In the future I think we can actually have the key itself inside the `TyFunctionDecl`, allowing that parsed and generated function to never collide or anything.

### @xunilrj — 1 reactions  
`👍 1`  ·  [link](https://github.com/FuelLabs/sway/pull/5427#issuecomment-1978699174)

> > General remark. @tritao's concern about debug symbols and loosing span information when desugaring is valid, especially in this approach when we generate the code by compiling code snippets. It looks to me we will need something like #line directive for generated code.
> 
> I will need to dive into our solution for debug, but I do intend for generated code to have spans. I imagine we will need these spans to point to real files to debug to work. 
> 
> I have created this issue to track this: https://github.com/FuelLabs/sway/issues/5696

### @jjcnn — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/5427#issuecomment-1967149715)

> I understand this example in principle, but there seems to be things missing:
> 
> ```
> let base_asset_id = BASE_ASSET_ID;
> let other_contract_id = ContractId::from(0xa38576787f8900d66e6620548b6da8142b8bb4d129b2338609acd121ca126c10);
> 
> let test_contract = abi(ContextTesting, other_contract_id.into());
> let returned_contract_id = test_contract.get_id { gas: gas, coins: 0, asset_id: BASE_ASSET_ID.value}(1, 2, 3);
> ```
> 
> > [and] will be transformed to
> 
> ```
> let base_asset_id = BASE_ASSET_ID;
> let other_contract_id = ContractId::from(0xa38576787f8900d66e6620548b6da8142b8bb4d129b2338609acd121ca126c10);
> 
> let test_contract = abi(ContextTesting, other_contract_id.into());
> let returned_contract_id = contract_call::<ContractId, _>(other_contract_id.into(), "get_id", (1, 2, 3), coins, asset_id, gas);
> ```
> 
> Are `gas` and `coins` implicitly defined variables?
> 
> Is it necessary to defined `base_asset_id` instead of just using `BASE_ASSET_ID` in the contract call?

### @xunilrj — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/5427#issuecomment-1967304024)

> > Are gas and coins implicitly defined variables?
> 
> No they are standard variables. Nothing special about them.
> 
> > Is it necessary to defined base_asset_id instead of just using BASE_ASSET_ID in the contract call?
> 
> It is not necessary, but it is an option that we give when a contract call is made. See https://docs.fuel.network/docs/sway/sway-program-types/smart_contracts/#calling-a-smart-contract-from-a-script
> 
> > You also have the option of specifying the following special parameters inside curly braces right before the main list of parameters:
> >
> > gas: a u64 that represents the gas being forwarded to the contract when it is called.
> > coins: a u64 that represents how many coins are being forwarded with this call.
> > asset_id: a b256 that represents the ID of the asset type of the coins being forwarded.

### @jjcnn — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/5427#issuecomment-1969260265)

> > > Are gas and coins implicitly defined variables?
> > 
> > No they are standard variables. Nothing special about them.
> > 
> 
> So the examples are not self-contained, then? For instance, I see a variable `gas` which is not defined anywhere, and which is used to initialize the `gas` parameter to the contract call.

### @ironcev — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/5427#issuecomment-1969298585)

> > So the examples are not self-contained
> 
> Exactly, they are more like code snippets.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
