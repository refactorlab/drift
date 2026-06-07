# AlistGo/alist #6475 — feat: add support for lark driver

**[View PR on GitHub](https://github.com/AlistGo/alist/pull/6475)**

| | |
|---|---|
| **Author** | @wintbiit |
| **Status** | ✅ merged |
| **Opened** | 2024-05-20 |
| **Repo importance** | ★49,602 · 7,941 forks · score 86,335 |
| **Diff** | +558 / −1 across 7 files |
| **Engagement** | 23 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @wintbiit — 1 reactions  
`👍 1`  ·  [link](https://github.com/AlistGo/alist/pull/6475#issuecomment-2746304209)

> > 大佬 , 可以预览, 不能下载. 
> > https://github.com/AlistGo/alist/issues/8212
> 
> 看起来有不少问题了，我下周看看重新修复一下这个插件

### @wintbiit — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6475#issuecomment-2119560240)

> Build failed for i386 and arm/v7 os because of sonic and other int64 issues. Is there a build tag in alist that I can use to include this driver only in x64 and arm64?

### @anwen-anyi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6475#issuecomment-2121587321)

> 1. Tenant url prefix 填写什么吖？
> ![image](https://github.com/alist-org/alist/assets/56105412/abedc867-88b3-4ec2-8a7f-0a29c778dfae)
> 
> 2. `飞书云空间` 入口在哪儿吖？自建企业了没找到在网页端
> 3. 是否需要开启一些API权限
> 
> -----
> ### 补充
> -----
> 应该得开启这些权限吧？
> ![image](https://github.com/alist-org/alist/assets/56105412/f9d53c58-0ae8-4227-89e3-7fae8dc0ad81)
> 
> 我开启上面权限后通过AList创建一个文件夹后在飞书后台没找到这个文件夹
> ![image](https://github.com/alist-org/alist/assets/56105412/58fe850b-b12b-4a27-a7b5-fbacca029602)
> 
> 然后在飞书后台创建了一个文件夹和上传了一个文件无法在AList前台显示 哈哈~
> ![image](https://github.com/alist-org/alist/assets/56105412/b89cf281-1c97-47b8-92a1-9e2250af752c)

### @anwen-anyi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6475#issuecomment-2126179175)

> 是不是那里不对？没有添加进去？ 还是说做了限制~ 使用自动构建的包和我自己编译的都没有这个飞书的驱动？ 😹 
> - 设备信息 `64 位操作系统, 基于 x64 的处理器`
> 
> 自动构建的包
> - https://github.com/alist-org/alist/actions/runs/9197601850
> - https://github.com/alist-org/alist/actions/runs/9194235942

### @anwen-anyi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6475#issuecomment-2126186149)

> > 好像忘记加Windows了
> 
> 只有是  `x64`或者`arm64`类型的设备能用吗？ Windows/以及Linux ， ~~Mac呢~~ (看到了)

### @anwen-anyi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6475#issuecomment-2131196201)

> > 1. Tenant url prefix 填写什么吖？
> >    ![image](https://private-user-images.githubusercontent.com/56105412/332254957-abedc867-88b3-4ec2-8a7f-0a29c778dfae.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTY2MzMxMTAsIm5iZiI6MTcxNjYzMjgxMCwicGF0aCI6Ii81NjEwNTQxMi8zMzIyNTQ5NTctYWJlZGM4NjctODhiMy00ZWMyLThhN2YtMGEyOWM3NzhkZmFlLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA1MjUlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwNTI1VDEwMjY1MFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI1Y2E1NzcyZmI5ZjRjNWUxYWEyOWU1N2Y0MmFhZGRkN2I5OTNlMzBkYjhjNTc4ZDhiMjVmNTk0NTkxNGQyZmUmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.SzF25-8PzbY2HbwMfsWuX2pQ_8RaDeJsraxp2YiEy3I)
> > 2. `飞书云空间` 入口在哪儿吖？自建企业了没找到在网页端
> > 3. 是否需要开启一些API权限
> 
> 填写这个域名或者 前缀都不行，可以告知一下么 :joy_cat:  属实搞不明白.... @wintbiit 
> ![image](https://github.com/alist-org/alist/assets/56105412/df89ad04-0677-41c6-95de-829cc71c2049)


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
