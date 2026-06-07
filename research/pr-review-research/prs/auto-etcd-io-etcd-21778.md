# etcd-io/etcd #21778 — Bump go.etcd.io/raft to v3.7.0-beta.0

**[View PR on GitHub](https://github.com/etcd-io/etcd/pull/21778)**

| | |
|---|---|
| **Author** | @serathius |
| **Status** | ✅ merged |
| **Opened** | 2026-05-21 |
| **Repo importance** | ★51,771 · 10,388 forks · score 98,318 |
| **Diff** | +1246 / −1309 across 73 files |
| **Engagement** | 37 conversation · 135 inline review comments |

## Top review comments (ranked by reactions)

### @liggitt — 1 reactions  
`👀 1`  ·  [link](https://github.com/etcd-io/etcd/pull/21778#issuecomment-4508745544)

> > WARNING: DATA RACE
> 
> ruh-roh ... is this something similar to the race we got in https://github.com/etcd-io/etcd/pull/21261#discussion_r2819339762 where a naive shallow-copy a message is no longer sufficient when passing it as a pointer and hanging onto internal mutable fields?

### @ahrtr — 1 reactions  
`👍 1`  ·  [link](https://github.com/etcd-io/etcd/pull/21778#issuecomment-4534104654)

> Suggest to pass all all protoc generated messages/structs as pointers firstly in separate PRs before bumping raft 3.7.0-beta.0

### @serathius — 1 reactions  
`👍 1`  ·  [link](https://github.com/etcd-io/etcd/pull/21778#issuecomment-4534153123)

> Will try to split and let you know. This will definitely help, so I want to try it.

### @serathius — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/21778#issuecomment-4519090356)

> Started testing with https://github.com/etcd-io/raft/pull/435

### @ahrtr — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/21778#issuecomment-4520416497)

> > Started testing with [etcd-io/raft#435](https://github.com/etcd-io/raft/pull/435)
> 
> The PR was just merged. Pls sync this PR. If the workflow is green, we can tag raft v3.7.0-beta.0

### @ahrtr — 0 reactions  
`—`  ·  [link](https://github.com/etcd-io/etcd/pull/21778#issuecomment-4526605019)

> https://github.com/etcd-io/raft/releases/tag/v3.7.0-beta.0
> 
> Pls feel free to update to this tag in this PR.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
