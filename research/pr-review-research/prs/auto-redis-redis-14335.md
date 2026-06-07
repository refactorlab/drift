# redis/redis #14335 — Handle primary/replica clients in IO threads

**[View PR on GitHub](https://github.com/redis/redis/pull/14335)**

| | |
|---|---|
| **Author** | @minchopaskal |
| **Status** | ✅ merged |
| **Opened** | 2025-09-04 |
| **Repo importance** | ★74,704 · 24,653 forks · score 178,313 |
| **Diff** | +886 / −86 across 19 files |
| **Engagement** | 17 conversation · 134 inline review comments |

## Top review comments (ranked by reactions)

### @ShooterIT — 1 reactions  
`👍 1`  ·  [link](https://github.com/redis/redis/pull/14335#issuecomment-3713530671)

> > putReplicasInPendingClientsToIOThreads can deal with it
> 
> I prefer we can handle that in a single place if possible

### @LiorKogan — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14335#issuecomment-3255011085)

> @minchopaskal - @fcostaoliveira built a benchmark for replication (we blogged about it [here](https://redis.io/blog/redis-8-0-m03-is-out-even-more-performance-new-features/)), where we measure 3 metrics.
> 
> IIRC, we benchmarked it without I/O threads, but it would be interesting to rerun this benchmark with I/O threads, before and after this PR.

### @ShooterIT — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14335#issuecomment-3594377289)

> For `IOThreadReplicationCron` for master client, maybe it is not necessary, the master send `PING` every second, and now we have `IOThreadClientsCron` that can send all clients to main thread for processing in one second, so maybe we can just add similar logic like `clientsCronRunClient` in `processClientsFromIOThread`,  i.g. `replCronRunMaster`
> 
> > ACK messages from primary
> 
> I want to know when replica clients comes back the main thread, only when a command from master arrives? maybe that will cause replication delay.

### @tezc — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14335#issuecomment-3600188819)

> @minchopaskal Do we have a benchmark somewhere? How much improvement do we see on master side?

### @minchopaskal — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14335#issuecomment-3615882836)

> > I want to know when replica clients comes back the main thread, only when a command from master arrives? maybe that will cause replication delay.
> 
> @ShooterIT Replica comes back to main thread whenever it has send the replication backlog data it knows about, unless some time has passed since it's received ACK from master. Then it remains in IO-thread until it reads ACK and is then send to main thread. 
> As for the replication cron - I've basically done that - see `runConnectedMasterClientReplicationCron` is called inside `processClientsFromIOThread`. Problem with removing `IOThreadReplicationCron` is that we have no guarantee that `IOThreadClientsCron` will actually send the master to main thread everytime it's called (unless we special case it) since it doesn't send all the clients (see `iterations` inside `IOThreadClientsCron`).
> 
> > Do we have a benchmark somewhere? How much improvement do we see on master side?
> 
> @tezc  I think I've run one a while ago, but since then the code in `unstable` has changed a lot. @filipecosta90 could we run a benchmark comparing with unstable?

### @ShooterIT — 0 reactions  
`—`  ·  [link](https://github.com/redis/redis/pull/14335#issuecomment-3625325053)

> > Then it remains in IO-thread until it reads ACK and is then send to main thread.
> 
> I think this method may cause a delay
> 
> for replication cron, an extra cron looks duplicated to me. We run IOThreadClientsCron 10 times per second, so generally we can run it in a second, maybe there is a delay but i think it is acceptable, besides, if master-slave sync is ok, the master will send PING every second


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
