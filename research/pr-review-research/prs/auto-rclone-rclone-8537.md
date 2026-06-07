# rclone/rclone #8537 — Filen Backend

**[View PR on GitHub](https://github.com/rclone/rclone/pull/8537)**

| | |
|---|---|
| **Author** | @Enduriel |
| **Status** | ✅ merged |
| **Opened** | 2025-05-04 |
| **Repo importance** | ★57,770 · 5,131 forks · score 83,292 |
| **Diff** | +1459 / −0 across 13 files |
| **Engagement** | 37 conversation · 15 inline review comments |

## Top review comments (ranked by reactions)

### @danieletorelli — 34 reactions  
`👍 34`  ·  [link](https://github.com/rclone/rclone/pull/8537#issuecomment-3495243169)

> hello, any updates on this? I'd really love to use this on a stable release :)

### @Enduriel — 12 reactions  
`👍 1 · ❤️ 11`  ·  [link](https://github.com/rclone/rclone/pull/8537#issuecomment-3730049474)

> Quick update from my side before a material update to the PR hopefully tomorrow. I've implemented ChunkWriter and removed all the backend side parallelization like we discussed.
> 
> This isn't currently an issue but I do not allow Chunk sizes that are not multiples of 1 MiB, this would be very annoying to handle for this backend and basically remove all the parallelization benefits, I hope that's not a problem, it still passes all the relevant tests.
> 
> I've also fixed lacking support for SeekOption and the lack of logging unsupported mandatory options for future-proofing.
> 
> I still need to rebase and test on the latest master branch, but I suspect there won't be any issues there.
> 
> Just finished a [test](https://github.com/user-attachments/files/24532832/2026-01-09-172718.zip) confirming that the ChunkWriter stuff is working as well.
> 
> Still a couple minor tweaks, but getting there.

### @gablilli — 11 reactions  
`👍 8 · 👀 3`  ·  [link](https://github.com/rclone/rclone/pull/8537#issuecomment-3218027908)

> Any updates on this? We Filen users are anxiously waiting...

### @ncw — 10 reactions  
`👍 10`  ·  [link](https://github.com/rclone/rclone/pull/8537#issuecomment-3582648585)

> Hi @Enduriel - sorry we didn't get this into v1.72 - lets try for v1.73. 
> 
> I understand the state to be
> - one failing bisync test which I don't think is very important
> - some problem with using up too much memory when doing transfers - this is important
> 
> Backends shouldn't be managing their own RAM. The upper layers of rclone have lots of code to deal with that and backends are supposed be be dumb.
> 
> Rclone has a framework for both multithreaded downloads and uploads and I'd like the filen backend to fit into that. This means that the memory used in outstanding buffers is limited by the rclone core and controllable by the user in well documented ways.
> 
> For downloads the multithreaded download code should work. The user can put up the number of download threads to as large as desired. This means that Open call needs to work well with chunks.
> 
> For uploads if the backend implemented OpenChunkWriter - that would be my preferred way forward. It is a relatively simple interface and the user can control concurrency and memory use directly. The OpenChunkWriter interface says what chunk size it uses to the rclone core, so you could use 1MB or a multiple of that.
> 
> If you want to have a private discussion then email us info@rclone.com - thanks.

### @Enduriel — 10 reactions  
`👍 5 · ❤️ 5`  ·  [link](https://github.com/rclone/rclone/pull/8537#issuecomment-3586621169)

> @ncw 
> 
> > Do you think the `OpenChunkWriter` interface is a possibility?
> 
> Sorry if I wasn't clear regarding this part, yes that would work great for uploads and I could trivially implement that now, but it would still try to parallelize things in the backend (even if it can't) so I will just make everything sequential given a range, and have rclone deal with the rest after implementing `OpenChunkWriter` for the backend.
> 
> > You mean if the range requests that rclone asks for don't align to a 1MB boundary?
> 
> Yes this was my exact concern
> 
> > By default rclone will use 64 MiB chunk sizes (for copying to the local backend) which should line up properly
> 
> That is good to hear in the sense that it won't cause unnecessary network for our servers or users, but this does mean that any medium sized individual files would upload relatively slowly (any files with <65MiB would have no parallelization which would make them very slow with our backend).
> 
> This is probably fine for the way that most people use rclone, but in an ideal world it would be really nice if rclone had a feature that allowed the backend to set the preferred chunk size for this. Maybe as a future feature?
> 
> Regardless, I'm clear on what to do now, thanks for getting back to me, and if there's any development on being able to adjust this size in the future or during this feature development, do let me know.

### @ncw — 10 reactions  
`👍 7 · ❤️ 1 · 🚀 2`  ·  [link](https://github.com/rclone/rclone/pull/8537#issuecomment-3744238496)

> I've made a free filen account and put it on the integration tester - https://integration.rclone.org/ - have a check tomorrow to see how it is doing!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
