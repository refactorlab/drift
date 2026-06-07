# rclone/rclone #7717 — backend: Add Apple iCloud Drive backend

**[View PR on GitHub](https://github.com/rclone/rclone/pull/7717)**

| | |
|---|---|
| **Author** | @lostb1t |
| **Status** | ✅ merged |
| **Opened** | 2024-04-02 |
| **Repo importance** | ★57,770 · 5,131 forks · score 83,292 |
| **Diff** | +2858 / −1 across 15 files |
| **Engagement** | 191 conversation · 96 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @lostb1t — 6 reactions  
`😄 6`  ·  [link](https://github.com/rclone/rclone/pull/7717#issuecomment-2056421333)

> crap i broke my icloud. Too many trash items and now the endpoint is broken lol 
> 
> the icloud web api is a mess

### @lostb1t — 4 reactions  
`🎉 4`  ·  [link](https://github.com/rclone/rclone/pull/7717#issuecomment-2049425629)

> Its slow but finished alle interfaces and all integration test are passing :tada:
> 
> Only documentation left before its ready for review.

### @lostb1t — 3 reactions  
`👍 1 · ❤️ 2`  ·  [link](https://github.com/rclone/rclone/pull/7717#issuecomment-2236601447)

> All unit tests are passing but some integration tests are failing ('test_all -backend iclouddrive -timeout 99999s') I think if those are fixed its in a good spot for release.
> 
> Tests that are failing are mostly about parallel functionality, where sometimes things go out of sync.

### @lostb1t — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/rclone/rclone/pull/7717#issuecomment-2054001437)

> > @lostb1t not sure if it's too early for bug reports, but currently it looks like app folders aren't being represented as folders, but rather as files.
> 
> bug reports are welcome. Will fix with the following pass, tnx

### @lostb1t — 2 reactions  
`👍 2`  ·  [link](https://github.com/rclone/rclone/pull/7717#issuecomment-2067637621)

> i hope to add support for it eventually.Its a different flow, need to dive in a bit to see what it entails

### @lostb1t — 1 reactions  
`👍 1`  ·  [link](https://github.com/rclone/rclone/pull/7717#issuecomment-2088084239)

> Alright this should be fixed. At least in my testing, let me know if it still occures.
> 
> PS the old way def worked  before as i run all the unit test without issue. And where now failing. So either Apple decided to kill it or they borked the endpoint. Either way, now using (a slower) other method


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
