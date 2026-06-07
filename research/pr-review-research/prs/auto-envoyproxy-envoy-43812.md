# envoyproxy/envoy #43812 — StatsAccessLogger:  fixes connection gauge underflow crashes when decrementing metrics after Scope evictions.

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/43812)**

| | |
|---|---|
| **Author** | @TAOXUY |
| **Status** | ✅ merged |
| **Opened** | 2026-03-06 |
| **Repo** | curated review-culture seed |
| **Diff** | +1140 / −168 across 10 files |
| **Engagement** | 37 conversation · 246 inline review comments |

## Top review comments (ranked by reactions)

### @ggreenway — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/43812#issuecomment-4040623926)

> > CMIIW, if gauge is evictable, it cannot be `dec`/`inc`. We need the central_cache in scope to hold the gauge for concurrent access.
> 
> The central store is the `Store`, and all scopes reference the same store. Anytime you get a metric from the scope, if the scope does not already have it, it looks in the store, so it is not possible for two scopes to have different metrics with the same name/tags.
> 
> That's why holding a reference to the stat in the FilterState makes this work: it keeps the metric and it's current value from being removed from the `Store`. 
> 
> > Imagine when a gauge is incremented and then evicted before decremented, there is another there is another accesslog accessing the same gauge using the same name and doing inc/dec, the value would be corrupted.
> 
> In this case, because the FilterState holds a reference, both would be using the same stat for inc/dec, so the value will not be corrupted.

### @TAOXUY — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/43812#issuecomment-4019860010)

> > I don't think your fix is quite right.
> > 
> > I ran the integration test you added without your code changes, and it fails in an assertion `ASSERT(used() || amount == 0);` in `sub()`. I think either the assertion is no longer valid in the case of evicted stats, or the stat is being set to unused incorrectly.
> > 
> > ```
> >       if (scope->evictable_) {
> >         MetricBag metrics(scope->scope_id_);
> >         CentralCacheEntrySharedPtr& central_cache = scope->centralCacheMutableNoThreadAnalysis();
> >         auto filter_unused = []<typename T>(StatNameHashMap<T>& unused_metrics) {
> >           return [&unused_metrics](std::pair<StatName, T> kv) {
> >             const auto& [name, metric] = kv;
> >             if (metric->used()) {
> >               metric->markUnused();
> >               return false;
> >             } else {
> >               unused_metrics.try_emplace(name, metric);
> >               return true;
> >             }
> >           };
> >         };
> > ```
> > 
> > The above code assumes that a stat is only ever held by a single scope (or other holder of a reference), which isn't correct. cc @kyessenov .
> > 
> > I think the use of `std::min` around all the `sub()` calls means that it's likely the counter could be incorrect. Even if this change prevents it from going negative, I think it is still an incorrect count.
> > 
> > /wait
> 
> Updated with a interface to not evict per metric. We need to keep gauge not evicted in the scope as that it can be looked-up and then dec/inc on the same gauge. @kyessenov

### @ggreenway — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/43812#issuecomment-4034887320)

> Here's an idea for another approach: add a new method to a scope to add a stat to the scope by it's GaugeSharedPtr. Then in the destructor of the FilterState, you can just directly re-add the existing gauge into the scope, without needing it's name/tag components.

### @TAOXUY — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/43812#issuecomment-4035858237)

> > Here's an idea for another approach: add a new method to a scope to add a stat to the scope by it's GaugeSharedPtr. Then in the destructor of the FilterState, you can just directly re-add the existing gauge into the scope, without needing it's name/tag components.
> 
> CMIIW, if gauge is evictable, it cannot be `dec`/`inc`. We need the central_cache in scope to hold the gauge for concurrent access.
> 
> Imagine when a gauge is incremented and then evicted before decremented, there is another 
> there is another accesslog accessing the same gauge using the same name and doing inc/dec, the value would be corrupted.
> 
> @kyessenov

### @jmarantz — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/43812#issuecomment-4078763527)

> Hi, sorry for jumping in late in the game -- I'm a previous maintainer and I used to work a lot with Envoy stats. I'd like to comment on this PR I think, but I'm wondering if there was anything like a design or proposal for what's being attempted here, so I can get some context on it.
> 
> I'm particularly interested in the use of GaugeSharedPtr (or other [StatType]SharedPtr if there are any) as I was coming to regret exposing the power of ref-counting individual stats outside the stat system itself (that was me). The reason is in #43958 we are addressing a severe performance issue -- visible on x86 but I think even more acute in ARM from excessive ref-count churn. It might be nice (though somewhat painful) to remove those shared-ptr types outside the internals of the stats system, as making stats strictly follow the lifetime of scopes will make the system a lot easier to reason about. Of course we need the refcounts inside the stat system because a stat can appear in more than one scope.
> 
> I'm also interested in the semantic relationship between Gauges and UpDown counters. Is this something that needs to be deeply built into the system, or could you just add a wrapper layer around Gauge (or maybe 2 counters?) to get the behavior you want? I think in the distant past someone tried to add an UpDownCounter and then decided against it; it might be possible to find the PR but there's no trace of anything merged in the system.

### @jmarantz — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/43812#issuecomment-4078778791)

> I'd also strongly recommend not messing with the thread_local_store's maze of caches. It is quite a lot to keep in my head; I didn't write it originally, but I wound up refactoring it in a few ways, and it takes a lot of head-scratching to keep it sane.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
