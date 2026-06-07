# AlistGo/alist #8342 — fix(thunder): fix login issue

**[View PR on GitHub](https://github.com/AlistGo/alist/pull/8342)**

| | |
|---|---|
| **Author** | @dgscyg |
| **Status** | ✅ merged |
| **Opened** | 2025-04-10 |
| **Repo importance** | ★49,602 · 7,941 forks · score 86,335 |
| **Diff** | +304 / −34 across 4 files |
| **Engagement** | 25 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @youtehub — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/AlistGo/alist/pull/8342#issuecomment-2929470103)

> 问题已经解决，现在新版本[v3.45.0](https://github.com/AlistGo/alist/releases/tag/v3.45.0) 开始之后。登录要么用用户中心的这个数字，要么去掉 **_+86_** 后的手机号码登录，才能弹出，下面的最后一个窗口。
> 
> ![image](https://github.com/user-attachments/assets/f0b0d6cd-be42-49c1-b016-d99139e426d4)
> ![image](https://github.com/user-attachments/assets/19043a37-c375-4fbf-a232-c85186ae3427)
> 
> 打开下面的网站：[https://i.xunlei.com/xlcaptcha/android.html](https://i.xunlei.com/xlcaptcha/android.html)
> ![image](https://github.com/user-attachments/assets/0f6a94a0-8441-4c15-8307-42464f8bd939)
> 
> 然后按住键盘的**F12**，选中控制台，按照这个格式将复制的内容加入到控制台后，内容就是添加的迅雷存储下面展示的**JSON字符串**。
> ```
>  reviewCb({ "creditkey": "", "reviewurl": "", "deviceid": "", "devicesign": "" }) 
> ```
> 点击确定会自动跳转过去，输入手机验证码就行，延后将 返回的 creditkey 中的长字符回填到  **信用密钥**
> ![image](https://github.com/user-attachments/assets/1c7b0eaf-c763-4f8f-802d-ba70905f756f)

### @cnazev — 2 reactions  
`👍 2`  ·  [link](https://github.com/AlistGo/alist/pull/8342#issuecomment-3097204666)

> 现在提示 ReferenceError: reviewCb is not defined

### @dgscyg — 1 reactions  
`👍 1`  ·  [link](https://github.com/AlistGo/alist/pull/8342#issuecomment-2794444436)

> > 下载还行，没跑满但也算正常，但视频播放很奇怪，不管是alist网页播放还是webdav播放速度都不行
> 
> 使用的是专业版驱动吗？
> 
> 播放一般都是单线程，是会比下载慢的

### @high0 — 1 reactions  
`😄 1`  ·  [link](https://github.com/AlistGo/alist/pull/8342#issuecomment-2949713040)

> 为了方便后来者在搜索的时候找到这个日志，我来加一些关键词
> 挂载迅雷
> 空白
> 没有获取验证码按钮
> 不显示
> 看不到按钮
> 没有按钮
> 获取验证码
> 验证码
> 迅雷云盘

### @MiKoto-Railgun — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/8342#issuecomment-2794342255)

> 试了一下，确实可以登录上了，可是速度很慢，我用的是我开了会员的账号，就这也才不到80kb/s，根本看不了一点

### @dgscyg — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/8342#issuecomment-2794354497)

> > 试了一下，确实可以登录上了，可是速度很慢，我用的是我开了会员的账号，就这也才不到80kb/s，根本看不了一点
> 
> 本次修改没有涉及到 下载接口，速度慢有使用本机代理或者改ua吗


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
