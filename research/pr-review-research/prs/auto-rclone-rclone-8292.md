# rclone/rclone #8292 — Add FileLu cloud storage backend

**[View PR on GitHub](https://github.com/rclone/rclone/pull/8292)**

| | |
|---|---|
| **Author** | @kingston125 |
| **Status** | ✅ merged |
| **Opened** | 2025-01-07 |
| **Repo importance** | ★57,770 · 5,131 forks · score 83,292 |
| **Diff** | +1652 / −1 across 15 files |
| **Engagement** | 33 conversation · 26 inline review comments |

## Top review comments (ranked by reactions)

### @kingston125 — 1 reactions  
`🎉 1`  ·  [link](https://github.com/rclone/rclone/pull/8292#issuecomment-2783378375)

> > How are you doing with this - is this ready to merge for v1.70?
> 
> Yes, this is ready to merge for v1.70.
> Thank you Nick.

### @ncw — 1 reactions  
`👍 1`  ·  [link](https://github.com/rclone/rclone/pull/8292#issuecomment-2786980266)

> Hi @kingston125 
> 
> I've been through the code and fixed up some things - you'll see I've squashed your commits and added another commit on top. Can you pull back the changed code and work on top of that please.
> 
> The integration tests are some way from passing. You can run this truncated set with `go test -v -short` - these should really all pass but we are getting these failures
> 
> ```
>         --- FAIL: TestIntegration/FsMkdir/FsMkdirRmdirSubdir (8.93s)
>         --- FAIL: TestIntegration/FsMkdir/FsListDirNotFound (0.32s)
>         --- FAIL: TestIntegration/FsMkdir/FsPutZeroLength (1.33s)
>         --- FAIL: TestIntegration/FsMkdir/FsPutFiles (10.14s)
>         --- FAIL: TestIntegration/FsMkdir/FsUploadUnknownSize (8.01s)
>             --- FAIL: TestIntegration/FsMkdir/FsUploadUnknownSize/FsUpdateUnknownSize (5.33s)
> ```
> 
> Can you get those ones to pass?
> 
> Other comments on the code:
> 
> 1. This is missing calls to the pacer. If you look at an example backend you'll see api calls are wrapped in a pacer.  Without this pacer, rclone will not retry network errors or obey `--low-level-retries` so it is really important. https://github.com/rclone/rclone/blob/205667143c807103b493e94bc0a708e10c435598/backend/box/box.go#L408-L411
> 2. This is not using rclone's HTTP stack. Can you make it use `lib/rest` please? Without that features like `--bwlimit`, `--dump headers`, `--tpslimit`, `--conntimeout`, `--timeout` etc won't work. At minimum it needs to use rclone's http transport but I'd prefer if it used `lib/rest` like the example backend (eg box).
> 3. The backend can clearly do DirMove, Copy according to … *[truncated]*

### @kingston125 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rclone/rclone/pull/8292#issuecomment-2835682538)

> Thank you for the info. I will start working on it and will let you know when it’s completed..

### @ncw — 0 reactions  
`—`  ·  [link](https://github.com/rclone/rclone/pull/8292#issuecomment-2579911108)

> I had a brief look at the code - it looks good :-) I'll do a full review later in the process.
> 
> First what I want to know is how are [the integration tests going](https://github.com/rclone/rclone/blob/master/CONTRIBUTING.md#writing-a-new-backend)? Are you at the stage `test_all` works properly?
> 
> Next if you look through the docs above you'll see that you need to write some docs next.
> 
> I take it from your user name that you work for FileLu ?
> 
> Thank you for the contribution

### @kingston125 — 0 reactions  
`—`  ·  [link](https://github.com/rclone/rclone/pull/8292#issuecomment-2580002098)

> > I had a brief look at the code - it looks good :-) I'll do a full review later in the process.
> > 
> > First what I want to know is how are [the integration tests going](https://github.com/rclone/rclone/blob/master/CONTRIBUTING.md#writing-a-new-backend)? Are you at the stage `test_all` works properly?
> > 
> > Next if you look through the docs above you'll see that you need to write some docs next.
> > 
> > I take it from your user name that you work for FileLu ?
> > 
> > Thank you for the contribution
> 
> Thank you!
> This is our first version of Rclone, so it's not perfect and still has room for improvement, but we will try our best. Yes, most of the commands are working. We still need to improve the mount command. I just added the filelu.md documentation.
> Yes, I work for FileLu.
> We appreciate all the feedback. Your feedback is incredibly valuable to us.

### @ncw — 0 reactions  
`—`  ·  [link](https://github.com/rclone/rclone/pull/8292#issuecomment-2585395866)

> > Thank you! This is our first version of Rclone, so it's not perfect and still has room for improvement, but we will try our best. Yes, most of the commands are working.
> 
> Great
> 
> > We still need to improve the mount command.
> 
> If you get the integration tests working properly, then mount will work properly too.
> 
> > I just added the filelu.md documentation. Yes, I work for FileLu. We appreciate all the feedback. Your feedback is incredibly valuable to us.
> 
> Let me know when you've got the integration tests passing (or mostly passing) and I'll do a full review.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
