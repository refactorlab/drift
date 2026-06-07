# freqtrade/freqtrade #12706 — Feature krakenfutures

**[View PR on GitHub](https://github.com/freqtrade/freqtrade/pull/12706)**

| | |
|---|---|
| **Author** | @hallonstedt |
| **Status** | ✅ merged |
| **Opened** | 2026-01-11 |
| **Repo importance** | ★51,169 · 10,663 forks · score 98,820 |
| **Diff** | +1418 / −20 across 12 files |
| **Engagement** | 17 conversation · 124 inline review comments |

## Top review comments (ranked by reactions)

### @hallonstedt — 2 reactions  
`👍 2`  ·  [link](https://github.com/freqtrade/freqtrade/pull/12706#issuecomment-3902237635)

> Pushed new commits addressing the latest review. The ccxt fix for #27894 in 4.5.38 allowed significant simplification:
> 
> - Bumped ccxt from 4.5.36 to 4.5.38
> - Removed the trigger order id fix, cancel stoploss, and fetch stoploss overrides. The base class handles stop param injection now via the stop flag capability. 
> - Aligned tests with the simplified stoploss handling; removed tests for deleted methods, added tests verifying the base class integration. 
> In total, I think we saved 200 lines of code there!
> 
> I did uncover another ccxt issue though;  the order status parser in ccxt's krakenfutures is missing mappings for uppercase status values returned by the orders/status endpoint (e.g. CANCELLED, TRIGGER_PLACED). These come through as-is instead of being normalized. I submitted a bug fix for this: ccxt/ccxt#27913

### @hallonstedt — 1 reactions  
`🚀 1`  ·  [link](https://github.com/freqtrade/freqtrade/pull/12706#issuecomment-3928460761)

> **trades=True**
> I checked the Kraken Futures API docs and the CCXT source. The /orders/status endpoint only accepts orderIds and cliOrdIds parameters, there is no trades parameter. CCXT's fetchOrder calls fetchOrders which hits privateGetOrdersStatus directly. Fills come from a completely separate endpoint (/fills), so there is no way to bundle them into a single request. The extra call in _adjust_krakenfutures_order is the same pattern as Hyperliquid's _adjust_hyperliquid_order.
> 
> **Fee schedules**
> Good point on the fee schedules and fee volume endpoints. Agreed it is not worth the effort at this point. The current approach uses CCXT's hardcoded default tiers (taker 0.0005, maker 0.0002), which is the same baseline other exchanges start with.
> 
> I will file two CCXT issues for the remaining bugs:
> triggerPrice/stopPrice always null for orders from /orders/status. parse_order reads triggerPrice from the top level but the endpoint nests it inside priceTriggerOptions.triggerPrice. Our workaround is a small _order_contracts_to_amount override that extracts it from the nested path. Without it, stoploss on exchange tracking would not know the stop level.
> ccxt/ccxt#27959
> 
> fee always None in parse_trade. The /fills endpoint returns fillType (maker/taker) but parse_trade hardcodes fee: None and never calculates it. Our workaround is a get_trades_for_order override that computes fee = cost * market[takerOrMaker] from the fee schedule. Without it, Freqtrade's fee detection would fall back to its own defaults rather than using the maker/taker classification Kraken provides.
> ccxt/ccxt#2795 … *[truncated]*

### @xmatthias — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/freqtrade/freqtrade/pull/12706#issuecomment-4018899222)

> the amount of necessary fixes here is ... surprising considering that krakenfutures isn't a new ccxt exchange. 
> 
> Good job on following up and keeping track of these though :+1:

### @hallonstedt — 1 reactions  
`👍 1`  ·  [link](https://github.com/freqtrade/freqtrade/pull/12706#issuecomment-4106546854)

> Trades, cancels, stoploss and a whole set of ccxt validators all run fine. I can't think of more things to validate so let's release this into the wild and I'm sure others will think of things to test that I haven't 🙂

### @hallonstedt — 0 reactions  
`—`  ·  [link](https://github.com/freqtrade/freqtrade/pull/12706#issuecomment-3737472603)

> @xmatthias  thank you for the feedback. I will start working on the comments right away.
>  
> "Hallucinated" is perhaps a tad harsh though. For me, Freqtrade is a fairly complex platform to contribute to, and the CCXT Kraken implementation is not straightforward. I'll learn as I dig deeper into the codebase to fix the issues. I used a fair amount of trial and error to get to the code submitted, well aware that it would need more work. I'll take it as a win that you didn't close it immediately!
> 
> Regarding the "sticking around", yes. I am spending time on this feature because I plan to use it. Live. So besides a genuine desire to contribute, I also have the incentive that I need the code to work to have my strategies running properly.

### @xmatthias — 0 reactions  
`—`  ·  [link](https://github.com/freqtrade/freqtrade/pull/12706#issuecomment-3737671535)

> > "Hallucinated" is perhaps a tad harsh though
> 
> it may be - overall it's not as bad as what i've seen before - it's individual functions that don't seem to make much sense. Knowing that it's AI (though clearly with you looking at it - which not everyone does!) - it's still a good possibility that it's AI hallucinations which you missed in your look over it - and that's what i implied.
> it's not "you" hallucinated it (at least that's not what i meant) - but "the AI" that hallucinate - often due to lacking /outdated context or whatnot.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
