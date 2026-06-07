# rclone/rclone #9234 — iclouddrive: add iCloud Photos support and SRP authentication

**[View PR on GitHub](https://github.com/rclone/rclone/pull/9234)**

| | |
|---|---|
| **Author** | @Lyapsus |
| **Status** | ✅ merged |
| **Opened** | 2026-03-05 |
| **Repo importance** | ★57,770 · 5,131 forks · score 83,292 |
| **Diff** | +6295 / −480 across 12 files |
| **Engagement** | 56 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @mburget — 2 reactions  
`🎉 2`  ·  [link](https://github.com/rclone/rclone/pull/9234#issuecomment-4195282089)

> @Lyapsus : worked for me on macos 26.4 (25E246). 
> I was struggling to get icloud to work. https://github.com/rclone/rclone/issues/8587#issuecomment-3169264324 helped to go one step further but still not getting the 2FA code. Your branch made it.

### @MatthewIsHere — 1 reactions  
`🎉 1`  ·  [link](https://github.com/rclone/rclone/pull/9234#issuecomment-4063717740)

> Hi! I've been testing this for a few hours, and it works fantastic! All the features work well, but FUSE mounts are pretty sluggish. Excellent work :)

### @stv0g — 1 reactions  
`👀 1`  ·  [link](https://github.com/rclone/rclone/pull/9234#issuecomment-4108529176)

> Hi @Lyapsus,
> 
> Thanks! This is working great so far for me :)
> 
> My observations:
> - All basic functionality works ✅
>   - I test both my personal as well as a shared library.
>   - I have around 100k photos in my library and it is able to handle them. 
>   - Also corner cases such as a `/` in an album name seems to be supported well.
> - Many operations are fairly slow ⚠️
>   - Looking at the debug trace, it appears to me that the initial validation of the session takes about 5 seconds, before any subsequent request is performed?
>   - As there are no albums in the shared library, listing all photos in the shared library can be painfully slow.. But it still works :)
> - I did not had any luck with accessing albums which are grouped in an folder ❌
>   - The folder appears as a directory in the directory structure
>   - But this folder is simply empty.

### @Lyapsus — 1 reactions  
`🚀 1`  ·  [link](https://github.com/rclone/rclone/pull/9234#issuecomment-4136595799)

> @MatthewIsHere thank you again! You may want to try FUSE again - warm listings should be much faster now. Also recommended to use `--vfs-refresh --dir-cache-time 1h --vfs-cache-mode full` with it. The cold initial listings of very large albums are still fairly slow but from now on it will happen only once per album and cache will handle the rest

### @Lyapsus — 1 reactions  
`👍 1`  ·  [link](https://github.com/rclone/rclone/pull/9234#issuecomment-4150392700)

> @Unbounded6106 thanks again and sorry for your time. It seems your account response format differs somehow. I pushed another commit that logs raw responses with -vv. Would be glad if you find another minute for this

### @Lyapsus — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rclone/rclone/pull/9234#issuecomment-4150878496)

> @Unbounded6106, thank you again! Apple wraps the auth response differently for your account for some reason. I just pushed a new one - I believe, it should handle it. May I ask for another round?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
