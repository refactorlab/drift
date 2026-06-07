# AlistGo/alist #7843 — fix(archive): unable to preview

**[View PR on GitHub](https://github.com/AlistGo/alist/pull/7843)**

| | |
|---|---|
| **Author** | @j2rong4cn |
| **Status** | ✅ merged |
| **Opened** | 2025-01-19 |
| **Repo importance** | ★49,602 · 7,941 forks · score 86,335 |
| **Diff** | +287 / −73 across 8 files |
| **Engagement** | 20 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @j2rong4cn — 1 reactions  
`👍 1`  ·  [link](https://github.com/AlistGo/alist/pull/7843#issuecomment-2606405886)

> @KirCute 由云盘并发限制引起的问题基本解决了，预览压缩包结构基本没问题，但解压7z，rar时不是很理想，有时CPU占用异常的高，得等mholt/archives包 更新优化

### @j2rong4cn — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7843#issuecomment-2600800959)

> 测试下载zip压缩包里的文件。配合 下面PR的功能 可以提速！！！
> * #7829
> ###  `下载客户端`的下载速度是`解压速度`，流量监控显示的才是真实`下载速度`
> ![{428F1C44-F293-4B5E-9207-30A1657F61F5}](https://github.com/user-attachments/assets/d5886fa8-4b63-4a32-8dc5-d90fb405339f)
> 
> ![{2FDB6785-04A9-49C6-A5C5-A665A65B37B4}](https://github.com/user-attachments/assets/85380399-f9c4-4ab4-89a3-c9e389ffe43f)

### @j2rong4cn — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7843#issuecomment-2601605450)

> @KirCute 现在zip支持返回tree了，但没排序，好像只适合前端排序，毕竟不是每个文件夹都会被浏览，你可以在前端写个排序吗？

### @KirCute — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7843#issuecomment-2601655589)

> > @KirCute 现在zip支持返回tree了，但没排序，好像只适合前端排序，毕竟不是每个文件夹都会被浏览，你可以在前端写个排序吗？
> 
> 前端已经实现排序了，不过默认状态下应该是不排序的，点列表的表头就能排序

### @j2rong4cn — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7843#issuecomment-2601674620)

> > > @KirCute 现在zip支持返回tree了，但没排序，好像只适合前端排序，毕竟不是每个文件夹都会被浏览，你可以在前端写个排序吗？
> > 
> > 前端已经实现排序了，不过默认状态下应该是不排序的，点列表的表头就能排序
> 
> 请求/api/fs/archive/meta的返回中有tree，没有请求/api/fs/archive/list，就会这样，少了置顶文件夹
> ![image](https://github.com/user-attachments/assets/3146f414-5e68-4d45-b660-e221a6f6b5a2)

### @KirCute — 0 reactions  
`—`  ·  [link](https://github.com/AlistGo/alist/pull/7843#issuecomment-2601687573)

> > > > @KirCute 现在zip支持返回tree了，但没排序，好像只适合前端排序，毕竟不是每个文件夹都会被浏览，你可以在前端写个排序吗？
> > > 
> > > 
> > > 前端已经实现排序了，不过默认状态下应该是不排序的，点列表的表头就能排序
> > 
> > 请求/api/fs/archive/meta的返回中有tree，没有请求/api/fs/archive/list，就会这样，少了置顶文件夹 ![image](https://private-user-images.githubusercontent.com/36783515/404787739-3146f414-5e68-4d45-b660-e221a6f6b5a2.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MzczNjAzNTEsIm5iZiI6MTczNzM2MDA1MSwicGF0aCI6Ii8zNjc4MzUxNS80MDQ3ODc3MzktMzE0NmY0MTQtNWU2OC00ZDQ1LWI2NjAtZTIyMWE2ZjZiNWEyLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAxMjAlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMTIwVDA4MDA1MVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTFkMzE1MTI5NTAxM2NmOWY3YmRiYTg0ZDA0MGYwZjE4Y2VjNDJiZTYxNDdiYmU4NmZhZmIzMTliMTAyNmFiZmEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.i4u3ljPmWzZSwMlA_7Vj3UdGlfnZ46kwcSWU444KNno)
> 
> 调用`/list`的结果看起来像是排过序是因为[archive.go#L134](https://github.com/AlistGo/alist/blob/11b6a6012f256facbeaf9314281321b05eeadef3/internal/op/archive.go#L134)处做了`op.List`会做的一些排序操作，在`op.GetArchiveMeta`里对每级目录也做类似的操作就能实现排序和提取文件夹


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
