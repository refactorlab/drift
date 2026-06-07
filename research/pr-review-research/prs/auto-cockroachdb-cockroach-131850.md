# cockroachdb/cockroach #131850 — raft: add tracing to raft

**[View PR on GitHub](https://github.com/cockroachdb/cockroach/pull/131850)**

| | |
|---|---|
| **Author** | @andrewbaptist |
| **Status** | ✅ merged |
| **Opened** | 2024-10-03 |
| **Repo** | curated review-culture seed |
| **Diff** | +1087 / −54 across 26 files |
| **Engagement** | 24 conversation · 268 inline review comments |

## Top review comments (ranked by reactions)

### @andrewbaptist — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/cockroachdb/cockroach/pull/131850#issuecomment-2417727464)

> A trace with this enabled looks like this:
> <img width="1283" alt="image" src="https://github.com/user-attachments/assets/b71073c0-a693-4e76-a712-37076a8f15de">
> [trace.txt](https://github.com/user-attachments/files/17401554/trace.txt)
> 
> Searching for the id can be done with a command like this:
> ```
> baptist_cockroachlabs_com@gceworker-abaptist:~/go/src/github.com/cockroachdb/cockroach$ roachprod ssh $CLUSTER "grep i27814158/e928.f674 logs/cockroach.log"
> baptist-test:[1 2 3 4]: grep i27814158/e928.f674 lo... 4/4
>    1: 	<err> COMMAND_PROBLEM: exit status 1
> 
>    2: 	<ok>
> 	I241016 19:04:23.721573 308 kv/kvserver/replica_proposal_buf.go:1185 ⋮ [T1,Vsystem,n2,s2,r150/4:‹/Table/106/1/{-91320…-1}›,id=i27814158/e928.f674] 138708  registering local trace i27814158/e928.f674
> 	I241016 19:04:23.721682 308 kv/kvserver/replica_raft.go:1998 ⋮ [T1,Vsystem,n2,s2,r150/4:‹/Table/106/1/{-91320…-1}›,id=i27814158/e928.f674] 138709  4->1 MsgApp Term:13 Log:13/27814157 Range:27814158-27814158
> 	I241016 19:04:23.721741 308 kv/kvserver/replica_raft.go:1998 ⋮ [T1,Vsystem,n2,s2,r150/4:‹/Table/106/1/{-91320…-1}›,id=i27814158/e928.f674] 138710  4->2 MsgApp Term:13 Log:13/27814157 Range:27814158-27814158
> 	I241016 19:04:23.721784 308 kv/kvserver/replica_raft.go:1192 ⋮ [T1,Vsystem,n2,s2,r150/4:‹/Table/106/1/{-91320…-1}›,id=i27814158/e928.f674] 138711  4->AppendThread MsgStorageAppend Term:0 Log:13/27814158 Range:27814158-27814158
> 	I241016 19:04:23.722126 319 kv/kvserver/replica_raft.go:1974 ⋮ [T1,Vsystem,n2,s2,r150/4:‹/Table/106/1/{-91320…-1}›,id=i27814158/e928.f674] 138712  4->4 MsgAppResp Term:13 Index:2781415 … *[truncated]*

### @andrewbaptist — 1 reactions  
`👍 1`  ·  [link](https://github.com/cockroachdb/cockroach/pull/131850#issuecomment-2423236814)

> Looking at a cluster running a workload that has relatively good performance but some slowdowns, the relevant section of the trace now look like this:
> ```
>      1.381ms      0.062ms                            event:kv/kvclient/kvcoord/range_iter.go:220 [n1,client=10.142.0.105:40404,hostssl,user=roachprod,txn=99326cbe] key: /Table/106/1/7939083717752317238/0, desc: r6735:/Table/106/1/793{7762535867303456-9607025825678572} [(n4,s8):1, (n7,s14):5, (n12,s24):4, next=6, gen=102, sticky=9223372036.854775807,2147483647]
> ...
>      2.559ms      0.026ms                                    event:kv/kvserver/replica_proposal_buf.go:825 [n4,s8,r6735/1:/Table/106/1/793{7762…-9607…}] attaching closed timestamp 1729277975.522853185,0 to proposal 44d9cb9e8cefe448
>      2.571ms      0.012ms                                    event:kv/kvserver/replica_proposal_buf.go:576 [n4,s8,r6735/1:/Table/106/1/793{7762…-9607…}] flushing proposal to Raft
>      2.578ms      0.007ms                                        === operation:raft trace _unfinished:1 _verbose:1 node:4 store:8 range:6735/1:/Table/106/1/793{7762…-9607…}
>      2.621ms      0.043ms                                        event:kv/kvserver/replica_proposal_buf.go:1189 [n4,s8,r6735/1:/Table/106/1/793{7762…-9607…}] registering local trace i6071/218b.18ba
>      2.667ms      0.046ms                                        event:kv/kvserver/replica_raft.go:2026 [n4,s8,r6735/1:/Table/106/1/793{7762…-9607…}] 1->5 MsgApp Term:8 Log:8/6070 Entries:[6071-6071]
>      2.706ms      0.039ms                                        event:kv/kvserver/replica_raft. … *[truncated]*

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/131850#issuecomment-2392145205)

> This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/cockroachdb/cockroach/131850)

### @andrewbaptist — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/131850#issuecomment-2392151676)

> A sample trace for a RF3 request:
> ```
>      4.035ms      0.031ms                                    event:kv/kvserver/replica_proposal.go:1003 [n2,s2,r70/2:/{Table/104-Max}] need consensus on write batch with op count=1
>      4.071ms      0.036ms                                    event:kv/kvserver/replica_raft.go:126 [n2,s2,r70/2:/{Table/104-Max}] evaluated request
>      4.096ms      0.025ms                                    event:kv/kvserver/replica_raft.go:171 [n2,s2,r70/2:/{Table/104-Max}] proposing command to write 1 new keys, 1 new values, 0 new intents, write batch size=46 bytes
>      4.123ms      0.027ms                                    event:kv/kvserver/replica_raft.go:282 [n2,s2,r70/2:/{Table/104-Max}] acquiring proposal quota (182 bytes)
>      4.159ms      0.036ms                                    event:kv/kvserver/replica_raft.go:459 [n2,s2,r70/2:/{Table/104-Max}] submitting proposal to proposal buffer
>      4.202ms      0.043ms                                    event:kv/kvserver/replica_proposal_buf.go:574 [n2,s2,r70/2:/{Table/104-Max}] flushing proposal to Raft
>      4.307ms      0.105ms                                    event:raft/raft.go:1336 [n2,s2,r70/2:/{Table/104-Max}] 2->None MsgProp Term:0 Log:0/0
>      4.360ms      0.053ms                                    event:raft/rawnode.go:445 [n2,s2,r70/2:/{Table/104-Max}] 2->1 MsgApp Term:8 Log:8/21
>      4.374ms      0.014ms                                    event:raft/rawnode.go:445 [n2,s2,r70/2:/{Table/104-Max}] 2->3 MsgApp Term:8 Log:8/21
>      4.396ms      0.022ms                                    event:raf … *[truncated]*

### @andrewbaptist — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/131850#issuecomment-2394654564)

> @pav-kv I attempted to incorporate all your changes, but hit a snag... After https://github.com/cockroachdb/cockroach/pull/70370/commits/2ad2bee257e78970ce2c457ddd6996099ed6727a, we now create tracing spans for all tasks launched from `RunAsyncTask`. I think this is the wrong thing to do, but it is unclear how to work around this. 
> 
> We are currently logging all the "right" things, and the tracing spans mostly look good on both the client and the server, but there is way too much logging because of this. 
> 
> I'm going to take a break now but will think again on Monday how to better work around this.

### @andrewbaptist — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/131850#issuecomment-2400756984)

> Outstanding tasks:
> 
> - [x] Handle the upgrade case due to the encoding change
> - [x] Don't persist the encoded bit
> - [x] Split the PRs into more digestible pieces
> - [x] Bench tests


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
