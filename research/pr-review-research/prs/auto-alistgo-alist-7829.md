# AlistGo/alist #7829 — feat(alias): add `DownloadConcurrency` and `DownloadPartSize` option

**[View PR on GitHub](https://github.com/AlistGo/alist/pull/7829)**

| | |
|---|---|
| **Author** | @j2rong4cn |
| **Status** | ✅ merged |
| **Opened** | 2025-01-17 |
| **Repo importance** | ★49,602 · 7,941 forks · score 86,335 |
| **Diff** | +396 / −238 across 24 files |
| **Engagement** | 26 conversation · 1 inline review comments |

## Top review comments (ranked by reactions)

### @xrgzs — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7829#issuecomment-2598844088)

> 在客户端支持多线程下载的情况下，测到会出现连接数过高的情况。
> 
> 是否能够限制一下，只在一侧实现多线程下载？不然这连接数太恐怖了。
> 
> ![](https://github.com/user-attachments/assets/3233ff8a-1dad-49ee-a7b7-64aea93e99e0)

### @j2rong4cn — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7829#issuecomment-2599362908)

> > 在客户端支持多线程下载的情况下，测到会出现连接数过高的情况。
> 
> 你这是什么客户端，多线程下载器吗？
> 这个适合给单线程的客户端 加速，例如播放器，alist的复制也只适合复制单个文件

### @j2rong4cn — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7829#issuecomment-2599376537)

> > 是否能够限制一下，只在一侧实现多线程下载？不然这连接数太恐怖了。
> 
> 你试一下alias套alias，，就是只有一侧是多线程的。。
> 这个得看客户端的多线程实现方法
> * 如果是 每个并发 只请求 分片大小的 就是 一侧多线程（这个PR的方案。适合在线播放 ）
> * 如果是 一个文件 多个线程下载，其中有一个线程下载完了再分片的 这种就不行 （大多数多线程下载器。适合下载 ）

### @hshpy — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7829#issuecomment-2599527963)

> > 在客户端支持多线程下载的情况下，测到会出现连接数过高的情况。
> > 
> > 是否能够限制一下，只在一侧实现多线程下载？不然这连接数太恐怖了。
> > 
> > ![](https://private-user-images.githubusercontent.com/26499123/404384856-3233ff8a-1dad-49ee-a7b7-64aea93e99e0.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MzcxNzUwMjEsIm5iZiI6MTczNzE3NDcyMSwicGF0aCI6Ii8yNjQ5OTEyMy80MDQzODQ4NTYtMzIzM2ZmOGEtMWRhZC00OWVlLWE3YjctNjRhZWE5M2U5OWUwLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAxMTglMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMTE4VDA0MzIwMVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTMzNWRkOWNjZmRkMDdmMWIzNDQ3OTc3NDVjZGYxNGEzMzEwYzZlYzQ0MGJiNzdhN2I3OWM1MzkwMzE3NGI2ODgmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.PcTOZwFWNq5ILHHRvkpVgbj83kYrbwkvpU6Zpb5YigU)
> 
> 客户端多线程直接用原驱动。
> 每个请求开启一个多线程下载器会占用系统内存，ra小于分片大小就是客户端侧多线程。

### @xrgzs — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7829#issuecomment-2599602477)

> @j2rong4cn OneDrive + IDM，alias按照你的参数设置，IDM 16线程

### @xrgzs — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7829#issuecomment-2599603510)

> ~~可以尝试判断一下客户端的 Range 请求头，或者屏蔽一下 Accept-Range 响应头~~
> 
> ~~https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Range~~
> 
> ~~https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Accept-Ranges~~
> 
> 不过这样应该会导致浏览器播放视频的时候无法实现快速时移


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
