# rclone/rclone #8886 — backend: Add Huawei Drive support

**[View PR on GitHub](https://github.com/rclone/rclone/pull/8886)**

| | |
|---|---|
| **Author** | @sanchuanhehe |
| **Status** | ✅ merged |
| **Opened** | 2025-10-08 |
| **Repo importance** | ★57,770 · 5,131 forks · score 83,292 |
| **Diff** | +4327 / −0 across 7 files |
| **Engagement** | 33 conversation · 32 inline review comments |

## Top review comments (ranked by reactions)

### @sanchuanhehe — 1 reactions  
`👍 1`  ·  [link](https://github.com/rclone/rclone/pull/8886#issuecomment-3665662810)

> > How is this going? Are the tests passing now or would you like some help, we would like to get this merged at some point! Thanks.
> 
> I’ve been a bit busy recently, so progress has slowed down. When I have more free time, I’ll continue pushing this forward. There are still a few parts of the Huawei Drive API that I don’t fully understand yet, and I need some time to clarify those before finishing the remaining integration tests and resolving the conflicts.

### @roucc — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/rclone/rclone/pull/8886#issuecomment-4243529622)

> After addressing the above please could you show the result of the integrations tests, then we can merge, thanks!

### @ncw — 1 reactions  
`👍 1`  ·  [link](https://github.com/rclone/rclone/pull/8886#issuecomment-4328057829)

> I pulled this locally to give it a test against a new Huawei Drive account I made for the integration tester.
> 
> I've pushed a commit with a couple of minor fixes on this branch.
> 
> I found that this backend test isn't working any more - can you fix that up and we'll merge for v1.74
> 
> Thank you
> 
> ```
> $ go test -v -run TestIntegration/FsMkdir/FsPutFiles/FsDirMove
> === RUN   TestIntegration
>     fstests.go:438: Using remote "TestHuaweiDrive:"
> === RUN   TestIntegration/FsMkdir
> === RUN   TestIntegration/FsMkdir/FsPutFiles
> === RUN   TestIntegration/FsMkdir/FsPutFiles/FsDirMove
>     fstests.go:1479: 
>         	Error Trace:	/home/ncw/go/src/github.com/rclone/rclone/fstest/fstests/fstests.go:1479
>         	Error:      	Received unexpected error:
>         	            	invalid parameters: HTTP error 400 (400 Bad Request) returned body: "{\"error\":{\"code\":400,\"description\":\"The addParentFolder and removeParentFolder are both empty or neither.\",\"errorDetail\":[{\"domain\":\"global\",\"reason\":\"PARAM_INVALID\",\"errorCode\":\"21004002\",\"description\":\"The addParentFolder and removeParentFolder are both empty or neither. ErrorNo:00-17-1777302004983-1917707334\",\"errorPos\":\"service\"}]}}"
>         	Test:       	TestIntegration/FsMkdir/FsPutFiles/FsDirMove
> --- FAIL: TestIntegration (4.90s)
>     --- FAIL: TestIntegration/FsMkdir (4.35s)
>         --- FAIL: TestIntegration/FsMkdir/FsPutFiles (4.05s)
>             --- FAIL: TestIntegration/FsMkdir/FsPutFiles/FsDirMove (0.97s)
> FAIL
> exit status 1
> FAIL	github.com/rclone/rclone/backend/huaweidrive	4.911s
> ```

### @ncw — 1 reactions  
`👀 1`  ·  [link](https://github.com/rclone/rclone/pull/8886#issuecomment-4334571757)

> That seems to have broken quite a few other integration tests for me, starting with this one `TestIntegration/FsMkdir/FsPutFiles/FsDirMove`
> 
> Can you check the backend integration tests, and also the test_all tests pass?
> 
> Thanks

### @ncw — 1 reactions  
`👀 1`  ·  [link](https://github.com/rclone/rclone/pull/8886#issuecomment-4386966796)

> @sanchuanhehe We've had a few of days in the integration tester with huawei drive now and we can see the tests are sometimes flaky.
> 
> https://integration.rclone.org/?date=2026-05-05-010021&filter=TestHuaweiDrive%3A
> 
> (Press left and right arrows to move in time)
> 
> Can you see if you can fix the flaky tests? Or offer suggestions?
> 
> Thanks

### @sanchuanhehe — 0 reactions  
`—`  ·  [link](https://github.com/rclone/rclone/pull/8886#issuecomment-3387820794)

> <img width="1074" height="315" alt="image" src="https://github.com/user-attachments/assets/ce8cd19a-55d5-4e0a-9754-f4e220673c46" />
> <img width="1075" height="382" alt="image" src="https://github.com/user-attachments/assets/da02afe9-a985-4347-a165-0e8679c07cb2" />
> Passed basic testing


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
