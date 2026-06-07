# bitcoin/bitcoin #31829 — p2p: improve TxOrphanage denial of service bounds

**[View PR on GitHub](https://github.com/bitcoin/bitcoin/pull/31829)**

| | |
|---|---|
| **Author** | @glozow |
| **Status** | ✅ merged |
| **Opened** | 2025-02-09 |
| **Repo** | curated review-culture seed |
| **Diff** | +2657 / −880 across 24 files |
| **Engagement** | 60 conversation · 413 inline review comments |

## Top review comments (ranked by reactions)

### @sipa — 6 reactions  
`👍 5 · ❤️ 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31829#issuecomment-2671888414)

> Sad to see this slip, but given the amount of changes and discoveries that necessitated them even in just the last week, it's probably the right decision.

### @glozow — 5 reactions  
`👍 5`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31829#issuecomment-2671912617)

> I'm sad too! Seeing the stats from https://delvingbitcoin.org/t/stats-on-orphanage-overflows/1421 made this more pressing in my opinion, but it's not a regression. I think we can still try to consider small, obviously safe changes for v29, but this feels too big. I don't want to risk creating new DoS problems.

### @sipa — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31829#issuecomment-2988441861)

> @instagibbs Ran your benchmarks with `-min-time=1000000` (so for ~18 minutes each) on a Ryzen 9 5950X CPU:
> 
> |               ns/op |                op/s |    err% |     total | benchmark
> |--------------------:|--------------------:|--------:|----------:|:----------
> |        8,005,268.73 |              124.92 |    0.1% |  1,074.80 | `OrphanageEvictionManyWithManyPeers`
> |        2,748,469.35 |              363.84 |    0.1% |  1,101.19 | `OrphanageEvictionManyWithOnePeer`
> |        7,783,037.34 |              128.48 |    0.1% |  1,073.93 | `OrphanageManyWithManyPeers`
> |        2,156,225.22 |              463.77 |    0.3% |  1,104.91 | `OrphanageManyWithOnePeer`
> 
> I also ran them once with all 4 in parallel (slower, but any temperature-related CPU speed fluctuations would affect all equally):
> 
> |               ns/op |                op/s |    err% |     total | benchmark
> |--------------------:|--------------------:|--------:|----------:|:----------
> |        9,601,227.92 |              104.15 |    0.2% |  1,105.00 | `OrphanageEvictionManyWithManyPeers`
> |        2,928,013.47 |              341.53 |    0.2% |  1,103.20 | `OrphanageEvictionManyWithOnePeer`
> |        9,237,659.67 |              108.25 |    0.6% |  1,105.15 | `OrphanageManyWithManyPeers`
> |        2,274,349.94 |              439.69 |    0.7% |  1,106.91 | `OrphanageManyWithOnePeer`
> 
> So 0.22-0.36 ms for many peers, and 0.59-0.65 ms for one peer?
> 
> If so, I'd say we can tolerate 5x-10x more?

### @instagibbs — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31829#issuecomment-3005901522)

> > together staying just below the global announcement and usage limits, but massively exceeding the per-peer usage reservation
> 
> Whiteboarded in person. Hopefully this explanation is clear and explains it in a more permanent location. If this ends up being correct we can adapt the benchmark to be more realistic.
> 
> The attack is as follows, assuming a global announcement count of 24,000, and per-peer reservation limit of 404kWU:
> 
> 1) Peer 0 sends a 260WU orphan
> 2) Peers 1 through 124 announce the same set of 193 transactions, each 261,656WU in size,
> but where each unique transaction is announced at least once as the 192nd and 193rd
> orphan for some peer. 
> 
> No global limits have been exceeded yet. 
> (Deduplicated) Usage: 261,656*193+240==50499848 < 50500000
> Announcement count: 193*124 + 1 == 23933 < 24000 
> 
> 3) Peer 0 then sends another tx, even minimally sized: 50499848+240==50500088 > 50500000
> 
> This causes trimming to start. Since Peers 1 through 124 all have the same DoS
> score for weight, their earliest announcements are trimmed one by one. No transactions
> are deleted until 193-2==191 announcements from each peer are removed. Once a single
> transaction in one of the selected peer's 192nd announcement causes a tx to be evicted, trimming stops. This
> only leaves partial announcements of 192nd, and the 193rd for each.

### @glozow — 2 reactions  
`👍 2`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31829#issuecomment-3009418385)

> > Whiteboarded in person. Hopefully this explanation is clear and explains it in a more permanent location. If this ends up being correct we can adapt the benchmark to be more realistic.
> 
> 🤦 yes sorry, I was being dumb. I think I'm still missing why peer 0 is separate from the others? These are the numbers I get:
> 
> - announcement limit `A=24,000`
> - number of peers `P=125`
> - number of unique transactions `N` = A / P = 24,000 / 125 = 192
> - total memory limit `M` = 404k * P = 50,500,000wu
> - size of each transaction `S` = M / N = 50,500,000 / 192 = 263,020
> 
> If we fill up this way, we're at capacity, and can send 1 small transaction to any of the peers, triggering evictions of `P * (N - 1) + 1` announcements?

### @sipa — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/bitcoin/bitcoin/pull/31829#issuecomment-3009676579)

> See https://github.com/sipa/bitcoin/commits/pr31829:
> * Makes a few preparatory behavior changes to make it more simulation-testable (return which announcements are made reconsiderable from `AddChildrenToWorkSet`, and tie-break equally-DoSy peers by picking the highest NodeId). Feel free to squash or otherwise incorporate these.
> * Add a simulation fuzz test which uses a super dumb vector of (wtxid, nodeid) pairs (in announcement order) to represent the state of the orphanage.
> * Adds a `std::set<Wtxid>` of reconsiderable wtxids to prevent having more than one reconsiderable announcement per wtxid (without this, i think `AddChildrenToWorkSet` might have some pathological cases where it iterates every announcement multiple times).


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
