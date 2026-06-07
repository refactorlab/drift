# FuelLabs/sway #6069 — feat: create and deploy a reference proxy contract for contracts with `[proxy]` enabled

**[View PR on GitHub](https://github.com/FuelLabs/sway/pull/6069)**

| | |
|---|---|
| **Author** | @kayagokalp |
| **Status** | ✅ merged |
| **Opened** | 2024-05-28 |
| **Repo importance** | ★61,652 · 5,423 forks · score 88,314 |
| **Diff** | +1438 / −83 across 20 files |
| **Engagement** | 53 conversation · 68 inline review comments |

## Top review comments (ranked by reactions)

### @sdankel — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/FuelLabs/sway/pull/6069#issuecomment-2204634310)

> > > 
> > 
> > > Currently, we ask for user input for both the proxy and the main contract deployment transactions. We should be able to just ask for the password, account to use, and user agreement only once.
> > 
> > I agree that this is more seamless but with current way it is possible to use a different account for paying for the update transaction. If the first deployment depletes the first account, a user would have the ability still continue with the transaction. That being said we can do this tradeoff
> 
> For these multi-tx deployments, I think we should also build in a mechanism where if an account runs out of gas after the first deployment, forc-deploy is suspended and gives the user a chance to fund the account before continuing, at which point forc-deploy will try that transaction again.
> 
> We could also give the user the option to choose a different account before retrying.
> 
> Even if the user can choose multiple accounts, they still could run into an issue where they run out of gas and don't want to have to redo the tx's that were already successful.
> 
> I think it would also be good to show an estimate of the total amount of gas for all transactions before they agree to sign the first one, so that they can ensure they'll have enough. If we are able to estimate it, we could also display information about which accounts have enough gas for the full deployment. This could be done as a follow up issue.

### @kayagokalp — 1 reactions  
`👍 1`  ·  [link](https://github.com/FuelLabs/sway/pull/6069#issuecomment-2159185462)

> I had to rebase as there were conflicts.

### @sdankel — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/6069#issuecomment-2161394677)

> I tried this out on `test/src/e2e_vm_tests/test_programs/should_pass/forc/contract_dependencies/contract_c/Forc.toml`
> 
> The first deployment was successful, and the Forc.toml was updated correctly.
> 
> The second time I tried deploying, I got this error:
> ```
> error: provider: io error: Response errors; InsufficientMaxFee { max_fee_from_policies: 0, max_fee_from_gas_price: 326087 }
> ```
> 
> However, there are sufficient funds in the account. Blocked by https://github.com/FuelLabs/fuels-rs/pull/1396
> 
> The other issue is that, for the second request, it's not clear to the user what they are signing. There should be a message like `Updating proxy_contract` before the user is asked to sign the transaction.
> 
> ![image](https://github.com/FuelLabs/sway/assets/47993817/6d083957-f746-4054-9c22-06965f5b9aea)

### @kayagokalp — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/6069#issuecomment-2197241090)

> SDK issues are solved should be able to update now. I also opened FuelLabs/forc#177 and will open a follow-up to this one to further clean forc-client.

### @sdankel — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/6069#issuecomment-2197806642)

> The output after updating the proxy contract needs some tweaking:
> - `0x` should be at the beginning of the address, not the line
> - "Updated" should be bold to match the style of `Updating`
> 
> ![image](https://github.com/FuelLabs/sway/assets/47993817/f978e3f9-a9e0-4a8b-9a2e-d9225f6c429e)

### @JoshuaBatty — 0 reactions  
`—`  ·  [link](https://github.com/FuelLabs/sway/pull/6069#issuecomment-2199255991)

> Thanks Kaya, this is great. Appreciate the thoughtful documentation updates. I think adding more tests might be useful before merging this though. Here's a few suggestions:
> 
> * Add an integration test simulating the full workflow of enabling, deploying, and updating proxy contracts.
> * Include error case testing to ensure proper handling of failure scenarios (e.g., invalid addresses, updating non-existent proxies).
> * Test the interaction between proxy and implementation contracts to verify correct function forwarding.
> * Verify the proxy contract's ownership controls, ensuring only the owner can update the target.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
