# AlistGo/alist #6464 — feat: add supports for thunderX driver

**[View PR on GitHub](https://github.com/AlistGo/alist/pull/6464)**

| | |
|---|---|
| **Author** | @dgscyg |
| **Status** | ✅ merged |
| **Opened** | 2024-05-17 |
| **Repo importance** | ★49,602 · 7,941 forks · score 86,335 |
| **Diff** | +1039 / −0 across 5 files |
| **Engagement** | 34 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @dgscyg — 3 reactions  
`👍 3`  ·  [link](https://github.com/AlistGo/alist/pull/6464#issuecomment-2124306443)

> > 1. 迅雷X 专家版也能抓包参数然后使用么？
> > 2. 使用 视频URL是做什么的吖？我看普通版本默认开启的，专家版（302）没开启家版（302）没开启
> 
> 回复：
> 1. 可以的，官方目前仅有APP端，抓包后填写相关参数同样可以正常使用。不过我已添加了 `Algorithms` 参数，在未失效的情况下，签名类型 选择 `Algorithms`后，可直接使用 `用户名` 和 `密码` 登陆
> 2. `视频URL` 开启后，会尝试使用接口返回的媒体链接进行替换原本的链接。目前官方对 `非会员` 情况下，下载链接进行了限速，但视频播放是不限速的。因此可以通过替换链接的方式来避免限速，这一点对于 `Alist` 媒体文件下载和在线播放均生效。对于普通文件，也可以采取重命名文件后缀为媒体格式（例如：`.mp4` ）的方式绕过限速。专家版没默认开启 `视频URL`选项，目的是针对于自行配置详细参数的人群来说，应当知晓该选项的意义，因此默认不启用。对于 `迅雷X` 驱动默认启用该选项，更多的是为了小白用户考虑。
> 3. 至于为什么 `迅雷X 专家版` 驱动启用了 `302`下载默认，而 `迅雷X` 驱动没有启用的问题。是考虑到 `302` 模式下，下载需要用到 `DownUserAgent`，否则无法下载。为了照顾小白用户，并没有对 `迅雷X` 驱动启用 `302`下载模式。如有需要可以使用 `迅雷X 专业版`。

### @anwen-anyi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6464#issuecomment-2123982912)

> 1. 迅雷X 专家版也能抓包参数然后使用么？
> 2. 使用 视频URL是做什么的吖？我看普通版本默认开启的，专家版（302）没开启家版（302）没开启

### @playingapi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6464#issuecomment-2124708297)

> Failed init storage: ErrorCode: 4022 ,Error: invalid_account_or_password ,ErrorDescription: verification failed

### @anwen-anyi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6464#issuecomment-2124731314)

> > Failed init storage: ErrorCode: 4022 ,Error: invalid_account_or_password ,ErrorDescription: verification failed
> 
> 你的账号密码不对

### @playingapi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6464#issuecomment-2124791787)

> > > Failed init storage: ErrorCode: 4022 ,Error: invalid_account_or_password ,ErrorDescription: verification failed
> > 
> > 你的账号密码不对
> 
> 确定账号密码没问题

### @playingapi — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/6464#issuecomment-2124816974)

> Failed init storage: Post "https://xluser-ssl.xunlei.com/v1/shield/captcha/init": EOF
> 
> 2024/05/22 21:34:49.818156 WARN RESTY Post "https://xluser-ssl.xunlei.com/v1/shield/captcha/init": EOF, Attempt 1
> 2024/05/22 21:34:54.331299 WARN RESTY Post "https://xluser-ssl.xunlei.com/v1/shield/captcha/init": EOF, Attempt 2
> 2024/05/22 21:34:58.837507 WARN RESTY Post "https://xluser-ssl.xunlei.com/v1/shield/captcha/init": EOF, Attempt 3
> 2024/05/22 21:35:03.510758 WARN RESTY Post "https://xluser-ssl.xunlei.com/v1/shield/captcha/init": EOF, Attempt 4
> 2024/05/22 21:35:03.510799 ERROR RESTY Post "https://xluser-ssl.xunlei.com/v1/shield/captcha/init": EOF


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
