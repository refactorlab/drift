# etcd-io/etcd #18274 — *: keep tombstone if revision == compactAtRev

**[View PR on GitHub](https://github.com/etcd-io/etcd/pull/18274)**

| | |
|---|---|
| **Author** | @fuweid |
| **Status** | ✅ merged |
| **Opened** | 2024-07-03 |
| **Repo importance** | ★51,771 · 10,388 forks · score 98,318 |
| **Diff** | +672 / −114 across 5 files |
| **Engagement** | 44 conversation · 52 inline review comments |

## Top review comments (ranked by reactions)

### @serathius — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/etcd-io/etcd/pull/18274#issuecomment-2262723340)

> Can you remove usage of https://github.com/etcd-io/etcd/blob/4488f2c9b6aa4f3f97cd231f3378e53f777d3212/tests/robustness/validate/watch.go#L345-L372 from robustness test to confirm that PR resolves the correctness issue?

### @fuweid — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/18274#issuecomment-2205940773)

> ping @ahrtr @serathius @siyuanfoundation @chaochn47 ~ PTAL, thanks

### @ahrtr — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/18274#issuecomment-2206051189)

> > ```
> > ➜  bin/tools/etcd-dump-db iterate-bucket ./default.etcd/member/snap/db key --decode
> > rev={Revision:{Main:4 Sub:0} tombstone:false}, value=[key "hello" | val "world-v2" | created 2 | mod 4 | ver 2]
> > rev={Revision:{Main:3 Sub:0} tombstone:false}, value=[key "hello-v2" | val "world" | created 3 | mod 3 | ver 1]
> > rev={Revision:{Main:2 Sub:0} tombstone:false}, value=[key "hello" | val "world" | created 2 | mod 2 | ver 1]
> > ```
> > 
> > 
> >     
> >   
> > 
> > Not sure we should fix it in the follow-up. Just want to highlight it.
> 
> I think it's expected behavior. Compaction always keeps the latest revision K, which is <= compaction_rev.

### @ahrtr — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/18274#issuecomment-2206153517)

> The e2e test cases, especially the mix-version test cases, as mentioned in https://github.com/etcd-io/etcd/pull/18162#issuecomment-2168322174 are important. What's the plan to implement the e2e test cases?

### @fuweid — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/18274#issuecomment-2206272296)

> > I think it's expected behavior. Compaction always keeps the latest revision K, which is <= compaction_rev.
> 
> ETCD server prevents requests from fetching revisions which are smaller than compacted revision. It looks fine to me.
> However, based on the compact API, if the revision is not latest and smaller than the compaction revision, that revision should be deleted.
> 
> > The e2e test cases, especially the mix-version test cases, as mentioned in https://github.com/etcd-io/etcd/pull/18162#issuecomment-2168322174 are important.
> 
> For the mix-version part, it's hard to finish it in one request. I'm trying to use patch mode in this pull request, like https://github.com/etcd-io/etcd/blob/main/tests/robustness/patches/beforeSendWatchResponse/watch.patch.

### @ahrtr — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/18274#issuecomment-2206600441)

> > ETCD server prevents requests from fetching revisions which are smaller than compacted revision. It looks fine to me.
> > However, based on the compact API, if the revision is not latest and smaller than the compaction revision, that revision should be deleted
> 
> It sounds reasonable, but we still have two options, either keep it as it's or fix it.
> 
> The rev, which is smaller than compaction rev, isn't accessible via the get/range API, but it's still in the db file. I agree it's an issue, but it seems harmless. Fixing it may break user experience as well. 
> 
> If we decide to fix it (let's go for this direction if there is NO objection), 
> - we should fix it in one PR instead of two.
> - evaluate the effort & impact.
> 
> > For the mix-version part, it's hard to finish it in one request.
> 
> It's OK to do it in followup PR, but we should manually verify it before we merge this PR. Please also feedback if you need help from others.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
