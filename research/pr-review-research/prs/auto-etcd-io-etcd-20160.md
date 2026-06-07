# etcd-io/etcd #20160 — cache: implement MVP watch demux

**[View PR on GitHub](https://github.com/etcd-io/etcd/pull/20160)**

| | |
|---|---|
| **Author** | @apullo777 |
| **Status** | ✅ merged |
| **Opened** | 2025-06-11 |
| **Repo importance** | ★51,771 · 10,388 forks · score 98,318 |
| **Diff** | +1549 / −1 across 10 files |
| **Engagement** | 25 conversation · 259 inline review comments |

## Top review comments (ranked by reactions)

### @serathius — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/etcd-io/etcd/pull/20160#issuecomment-2987987899)

> This looks much better, good job!
> 
> Expect maybe 1-2 more iterations and this will be mergable.

### @serathius — 2 reactions  
`👍 1 · 🎉 1`  ·  [link](https://github.com/etcd-io/etcd/pull/20160#issuecomment-3031988718)

> There are still a lot of things we can improve, but this looks like a good start. The most important thing next is fixing the `Atomic` watch property. The current implementation assumes that revision is a unique number, this is not true. 
> 
> TXN can have multiple operations (Put/Delete) that are executed within one transactions, all this operations will share revision. Atomic watch guarantee ensures that events that share revisions will always be send in single watch response and not broken up. https://etcd.io/docs/v3.5/learning/api_guarantees/#watch-apis
> 
> Prepared PR to show what I mean https://github.com/etcd-io/etcd/pull/20272

### @serathius — 1 reactions  
`👍 1`  ·  [link](https://github.com/etcd-io/etcd/pull/20160#issuecomment-2983649736)

> Overall note on architecture. You have two separate synchronization methods, first one sends events available in ringBuffer upon the watch creation, and second broadcasts new events to synchronized watchers. If a synchronized watcher don't handle the event, the only option you have is to drop it (count missed events is not correct). With watcher buffer 128 and shared buffer 2048 if watch just requests old revision, the per watcher buffer will be filled and broadcast will immediately fail. Fix to that is to keep a list of unsychronized watchers and periodically attempt to synchronize them.

### @serathius — 1 reactions  
`👍 1`  ·  [link](https://github.com/etcd-io/etcd/pull/20160#issuecomment-2995391531)

> Note, please close comments that you have addressed.

### @serathius — 1 reactions  
`👍 1`  ·  [link](https://github.com/etcd-io/etcd/pull/20160#issuecomment-3018591391)

> Please fix:
> ```
> cache_test.go:89:28: context.Background() could be replaced by t.Context() in TestCacheWatcherSeesEntireKeyspace (usetesting)
> 	if err := cache.WaitReady(context.Background()); err != nil {
> ```

### @serathius — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/20160#issuecomment-3007599303)

> Just couple of last comments, and this code is in mergeable. Please follow https://github.com/etcd-io/etcd/pull/20160/checks?check_run_id=44807170862 instructions to fix the DCO and remove the draft.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
