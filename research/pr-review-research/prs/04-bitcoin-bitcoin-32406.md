# bitcoin/bitcoin #32406 — policy: uncap datacarrier by default

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/32406)**

| | |
|---|---|
| **Author** | @instagibbs |
| **Status** | ✅ merged |
| **Opened** | 2025-05-02 |
| **Diff** | +146 / −94 across 26 files |
| **Engagement** | 164 conversation comments · 81 inline review comments |

## Why this PR is notable

Uncapping `datacarrier` (the OP_RETURN data-size debate) — a governance-level review. Contributors register structured signals: `BitcoinMechanic`'s *'Concept NACK'* with an incentives argument, `Sjors`'s *'Concept ACK'* with a technical rationale.

## 🧠 The lesson for reviewers

> Mature projects encode review as explicit, reasoned **ACK / NACK** signals that separate *concept* from *approach* from *code*. Disagreement becomes a structured protocol, not a personal fight.

## How the author framed it (PR description excerpt)

> Retains the `-datacarrier*` args, marks them as deprecated, and does not require another startup argument for multiple OP_RETURN outputs.
> 
> If a user has set `-datacarriersize` the value is "budgeted" across all seen OP_RETURN output scriptPubKeys. In other words the total script bytes stays the same, but can be spread across any number of outputs. This is done to not introduce an additional argument to support multiple outputs.
> 
> I do not advise people use the option with custom arguments and it is marked as deprecated to not mislead as a promise to offer it forever. The argument itself can be removed in some future release to clean up the code and minimize footguns for users.

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @BitcoinMechanic — 88 reactions  
`👍 79 · 😄 2 · 👎 7`  ·  [link](https://github.com/bitcoin/bitcoin/pull/32406#issuecomment-2851140070)

> Concept NACK. Nodes have no incentive to become free relays between those who want to store arbitrary data and miners. Setting defaults to the opposite effect just results in distrust of Core and migration away from it (as we have witnessed over the last week - although of course not Sybil resistant, seems genuine.)


### @wizkid057 — 61 reactions  
`👍 58 · 👎 3`  ·  [link](https://github.com/bitcoin/bitcoin/pull/32406#issuecomment-2851096930)

> Concept NACK
> Reasons outlined on mailing list and other PR


### @Sjors — 57 reactions  
`👍 16 · 👎 40 · 😕 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/32406#issuecomment-2851168826)

> Concept ACK. This adds a deprecation step to #32359, which seems fine from a technical point of view, and was requested by regular contributors as well.
> 
> It will re-invite the brigading when the actual code is removed, but it will be easier to point to earlier discussion.
> 
> Code looks reasonable at first glance, when compared to #32359, but will re-review it.
> 
> 3ba7449f6c335026b752366c53f9c309f09e6c64 could be split between a commit that allows multiple outputs and one that switches the default.
> 
> --- 
> 
> There's no need to Concept N(ACK) this if all you're going to do is repeat comments from #32359. They're not votes. Any actual reviewer of this PR (including maintainers) can read those arguments there.


### @BitcoinMechanic — 54 reactions  
`👍 54`  ·  [link](https://github.com/bitcoin/bitcoin/pull/32406#issuecomment-2851165167)

> > @BitcoinMechanic
> > 
> > > no incentive
> > 
> > Fee estimation and block propagation to name a few: https://groups.google.com/g/bitcoindev/c/d6ZO7gXGYbQ/m/3WVL60u6EQAJ
> 
> It does no harm to fee estimation or block propagation. Nodes can and do cache transactions they reject from their mempools making compact blocks just as quick to verify regardless of if some of their contents was filtered.
> 
> As for fee estimation, it does not require knowledge of "the" mempool and there can never be such a thing.
> 
> The efforts to design Bitcoin Core around the increased reliance on mempool homogeneity are misguided and a trend in the wrong direction.
> 
> More high level - if nodes can configure their own mempool policies it obviously doesn't break things and demonstrably never has.


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
