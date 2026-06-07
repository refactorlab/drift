# bitcoin/bitcoin #29415 — Broadcast own transactions only via short-lived Tor or I2P connections

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/29415)**

| | |
|---|---|
| **Author** | @vasild |
| **Status** | ✅ merged |
| **Opened** | 2024-02-09 |
| **Repo** | curated review-culture seed |
| **Diff** | +1534 / −81 across 28 files |
| **Engagement** | 181 conversation · 613 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @pinheadmz — 3 reactions  
`👍 1 · ❤️ 1 · 🚀 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/29415#issuecomment-2000288460)

> > Is this going to be on by default or just an option?
> 
> This PR only affects transactions sent with RPC `sendrawtransaction` and only if `-privatebroadcast=1` is configured, which is not default

### @andrewtoth — 3 reactions  
`❤️ 2 · 👀 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/29415#issuecomment-2776603494)

> @stratospher that's a great script, thanks! I've modified it slightly to use the more modern psbt wallet commands. This makes it not have to worry about inputs and also automatically sends back change to the wallet.
> 
> This does mean you will have to start bitcoind with `-fallbackfee=0.00003` for instance for 3 sat/vbyte fee.
> Also start bitcoind with `-privatebroadcast=1 -debug=privatebroadcast`.
> 
> ```
> #!/bin/bash
> cd bitcoin
> build/bin/bitcoin-cli -chain="signet" loadwallet test
> 
> new_address=$(build/bin/bitcoin-cli -chain="signet" getnewaddress)
> psbt=$(build/bin/bitcoin-cli -chain="signet" walletcreatefundedpsbt "[]" "[{\"$new_address\": 0.00001}]" | jq -r '.psbt')
> echo "psbt: $psbt"
> 
> signed_tx=$(build/bin/bitcoin-cli -chain="signet" walletprocesspsbt $psbt | jq -r '.hex')
> echo "signed_tx: $signed_tx"
> 
> raw_tx=$(build/bin/bitcoin-cli -chain="signet" sendrawtransaction $signed_tx)
> echo "raw_tx: $raw_tx"
> ```

### @vasild — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/29415#issuecomment-2785476282)

> > Could we have a small guide how to test this ... always have to lookup the rpc commands again.
> 
> Me too. Added "How to test this?" to the PR description, based on @stratospher and @andrewtoth's commands, thank you!

### @andrewtoth — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/29415#issuecomment-2816767319)

> ACK 2b34857ad54aebbf0a9271e742c2caee85577bc8 - modulo the functional test malleated valid witness comment
> 
> Made many successful private broadcast connections with all 4 network types.
> Successfully had connections timeout after sending the INV.
> Tested resending the same raw tx multiple times.
> Tested sending many double spends of the same tx at the same time.
> Successfully had stale txs reattempted.
> Tested with both `-maxconnections=0` and many inbound and outbound connections.

### @vasild — 1 reactions  
`👍 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/29415#issuecomment-1936992757)

> @1440000bytes, thanks for asking! There is some discussion at https://github.com/bitcoin/bitcoin/pull/27509 (the previous attempt on this).
> 
> > Is it necessary to open new short lived tor/i2p connections for broadcasting the transaction?
> 
> Yes, it is. See below.
> 
> > What are the trade-offs in this implementation vs a simple implementation to relay tx to one or more peers that our node is already connected to?
> 
> Sending the transaction over clearnet reveals the IP address/geolocation of the sender. A spy with many connections to the network could try to guess who was the originator. So, why not send it to our Tor peers only? Because it is relatively easy for a spy to fingerprint and link clearnet and Tor connections to the same peer. That is, a long running connection over Tor could be linked to a long running clearnet connection. This is why the proposed changes open a short-lived connection that does not reveal any of the identity of the sender.
> 
> Would this benefit nodes that don't have clearnet connections, e.g. Tor/I2P-only nodes? Yes! In the case where the sender sends two otherwise unrelated transactions over the same long-running Tor connection, the recipient will know that they have the same origin, even though they are not related on-chain. Using single shot connections fixes that too.
> 
> > Related issues:
> 
> Linked in the OP, thanks!

### @pinheadmz — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/29415#issuecomment-1986011938)

> concept ACK 6fad02cf03 
> 
> (code review in progress)
> 
> I am also testing this feature in Warnet, which deploys a regtest network and even has an internal Tor DA so I can simulate onion routing locally. Currently using a 20-node [graph](https://github.com/pinheadmz/warnet/blob/priv-broadcast/test/data/onion.graphml) and a [scenario](https://github.com/pinheadmz/warnet/blob/priv-broadcast/src/scenarios/onion_init.py) which connects the graph, adds onion addresses to the test node, and then sends a raw transaction from the node running this branch.
> 
> The private broadcast succeeds frequently but not always. In Warnet anyway I had better luck when the test node had `-listenonion=0`, I tried that after suspecting that inbound onion connections were removing potential peers from the private broadcast list, but I'm not sure.
> 
> I think I noticed this in the original PR as well, if multiple transactions are sent, the count keeps going up without a limit: 
> 
> ```
>  [privatebroadcast] Requested to open 60 connection(s), trying to open one
> ```
> 
> Screenshot below, I managed to capture a private broadcast connection! I'll mention when i get to that commit in review as well, but the connection type `"privbcast"` is breaking the very nice `-netinfo` table :-)
> 
> So far I have a few questions about the strategy:
> 
> 1. How do we pick the onion peers to relay to? If we avoid reusing peers then (especially in my miniature network) we can run out quickly, and nothing ever gets broadcast.
> 
> 2. Are we using fresh Tor identities for these connections? I think [Wasabi does something like this:](https://docs.wasa … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
