# immich-app/immich #26881 — fix(server): sync files to disk

**[View PR on GitHub](https://github.com/immich-app/immich/pull/26881)**

| | |
|---|---|
| **Author** | @uhthomas |
| **Status** | ✅ merged |
| **Opened** | 2026-03-12 |
| **Repo importance** | ★102,681 · 5,792 forks · score 130,849 |
| **Diff** | +47 / −59 across 2 files |
| **Engagement** | 79 conversation · 8 inline review comments |

## Top review comments (ranked by reactions)

### @alextran1502 — 2 reactions  
`👍 2`  ·  [link](https://github.com/immich-app/immich/pull/26881#issuecomment-4067232906)

> My setup is a typical production setup, NFS mount from a NAS with 7200 RPM HDDs raid5 configuration 
> 
> I don’t test on ideal setup hehe 😁

### @uhthomas — 1 reactions  
`👍 1`  ·  [link](https://github.com/immich-app/immich/pull/26881#issuecomment-4048048385)

> I would be more concerned if every single write was subject to sync, but syncing a whole file is fine. It does not make any sense to write dozens or hundreds of files and not have actually persisted them, especially when the current assumption is that they have been.
> 
> We have seen plenty of consistency issues, especially with unstable storage like SMB, NFS or USB. They are the most likely to benefit from this.
> 
> This is incredibly important. Immich shouldn't just yolo anything - people rely on Immich for backing up photos and videos and expect the backed up data the be durable.

### @uhthomas — 1 reactions  
`👍 1`  ·  [link](https://github.com/immich-app/immich/pull/26881#issuecomment-4048998232)

> I ran a quick bench on a 990 Pro and:
> 
> | Size  | No sync | `flush: true`        | Separate `fdatasync`  |                                                
> |-------|---------|----------------------|-----------------------|
> | 1KB   | 0.068ms | 0.082ms (+19%)       | 0.119ms (+73%)        |                                                
> | 100KB | 0.096ms | 0.114ms (+19%)       | 0.142ms (+48%)        |    
> | 1MB   | 0.330ms | 0.319ms (~0%)        | 0.420ms (+27%)        |                                                
> | 10MB  | 3.29ms  | 3.23ms (~0%)         | 3.15ms (~0%)          |    
> 
> So, no impact for large files on reasonable storage. I imagine there will be more of an impact on slower storage, but what other option is there? Lose data?

### @uhthomas — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/immich-app/immich/pull/26881#issuecomment-4049060328)

> @alextran1502 I considered allowing non sync writes for stuff like thumbnails and metadata, but we aren't doing any sort of integrity checking there at all. It is impossible to deterministically find and fix / regenerate thumbnails, etc which are corrupt because of this.
> 
> Some filesystems are slow, and will hold data in a cache for 30 seconds or minutes. As a user who has terabytes of photos and videos, not syncing to the filesystem properly makes me incredibly nervous and I hope that we can agree that data integrity and durability should be prioritised above everything else. If the performance is worse because we're actually handling data safely, then so be it. That's how it's supposed to be, and that's the philosophy that other systems (like Ceph) take. 
> 
> We _have_ to enforce this within Immich. It doesn't matter how great your storage medium is if the writes aren't being flushed to disk. Any number of things could prevent the write from actually being persisted and Immich would have no idea.

### @uhthomas — 1 reactions  
`👍 1`  ·  [link](https://github.com/immich-app/immich/pull/26881#issuecomment-4049155232)

> There's also no reason Immich shouldn't work with network mounts or precarious setups if the only thing preventing it from doing so is syncing properly. If we try to sync the data and it fails, then users will get proper errors rather than silent corruption.

### @alextran1502 — 1 reactions  
`👍 1`  ·  [link](https://github.com/immich-app/immich/pull/26881#issuecomment-4049178345)

> >  I/O will be the most expensive part of these operations and syncing should be minimal overhead.
> 
> @uhthomas 
> 
> Yeah. I will report back later this week. I am also very hopeful that the sync overhead is minimal in the grand scheme of things, but we will see. I have a very common setup for most use cases.
> 
> Can you help by just limiting the scope of sync to the upload path?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
