# krahets/hello-algo #1831 — add epub generator

**[View PR on GitHub](https://github.com/krahets/hello-algo/pull/1831)**

| | |
|---|---|
| **Author** | @codetypess |
| **Status** | ✅ merged |
| **Opened** | 2025-12-11 |
| **Repo importance** | ★126,570 · 15,114 forks · score 191,373 |
| **Diff** | +4781 / −0 across 18 files |
| **Engagement** | 34 conversation · 32 inline review comments |

## Top review comments (ranked by reactions)

### @codetypess — 2 reactions  
`👍 2`  ·  [link](https://github.com/krahets/hello-algo/pull/1831#issuecomment-3652716256)

> 自动构建问题不大，后面我处理一下，因为这些工作都是AI完成，我对EPUB的渲染的其实不了解，LaTeX的公式渲染已修复，其它的我抽时间让AI处理一下

### @codetypess — 1 reactions  
`👍 1`  ·  [link](https://github.com/krahets/hello-algo/pull/1831#issuecomment-3661382640)

> 可以通过阅读这个文档，使用命令行构建所有版本的EPUB，指定编程语言和文档语言
> https://github.com/zhongfq/hello-algo/blob/main/epub/README.md
> [hello-algo-en-java.epub.zip](https://github.com/user-attachments/files/24195680/hello-algo-en-java.epub.zip)
> [hello-algo-ja-cpp.epub.zip](https://github.com/user-attachments/files/24195684/hello-algo-ja-cpp.epub.zip)
> [hello-algo-zh-java.epub.zip](https://github.com/user-attachments/files/24195686/hello-algo-zh-java.epub.zip)

### @codetypess — 1 reactions  
`👍 1`  ·  [link](https://github.com/krahets/hello-algo/pull/1831#issuecomment-3673005889)

> [hello-algo_zh_python.epub.zip](https://github.com/user-attachments/files/24248349/hello-algo_zh_python.epub.zip)
> 
> 数学部分，已经优先指定数学字体了：
> <img width="848" height="436" alt="image" src="https://github.com/user-attachments/assets/a3b8732c-84db-46af-8bb1-3163df043117" />
> 
> 小章节之间不换页的，目前暂时搞不定，AI反复处理都有问题，要么目录不见了，要么样式不对，两者之间反反复复
> 
> 其它问题都调整了

### @codetypess — 1 reactions  
`👍 1`  ·  [link](https://github.com/krahets/hello-algo/pull/1831#issuecomment-3675634851)

> > > 目前每两个小节之间，会有一个完整的空白页，这个问题暂时无解，这个是两个HTML之间的过渡，得对EPUB格式非常熟悉可能才能可能解决
> > 
> > 之前版本的 epub 没有这个现象，会新起一页，但不会有完整的空页，例如： <img alt="image" width="2000" height="1383" src="https://private-user-images.githubusercontent.com/26993056/528681848-522c41b4-e385-40e3-adfe-4541c9355465.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjYxNjA1NDIsIm5iZiI6MTc2NjE2MDI0MiwicGF0aCI6Ii8yNjk5MzA1Ni81Mjg2ODE4NDgtNTIyYzQxYjQtZTM4NS00MGUzLWFkZmUtNDU0MWM5MzU1NDY1LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTEyMTklMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUxMjE5VDE2MDQwMlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTc0N2MxYzhkOTIwNDIxMzc4OTdhNDVjY2JjOTBhYTlmZmRjMTIxNTRmNmEwNjEyNzkwNmM0MzRkMDgyYzIxMzImWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.mkWfJIOHv_Z7rkvVNEHds9VZsDdnehEtbLcTb88vCfg">
> > 
> > 现在的是换页之后，还会有完整的空页，例如 p182-p184： <img alt="image" width="1560" height="1383" src="https://private-user-images.githubusercontent.com/26993056/528682145-408f25b4-8464-4cee-8151-c213481c02c4.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjYxNjA1NDIsIm5iZiI6MTc2NjE2MDI0MiwicGF0aCI6Ii8yNjk5MzA1Ni81Mjg2ODIxNDUtNDA4ZjI1YjQtODQ2NC00Y2VlLTgxNTEtYzIxMzQ4MWMwMmM0LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTEyMTklMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUxMjE5VDE2MDQwMlomWC1B … *[truncated]*

### @codetypess — 1 reactions  
`👍 1`  ·  [link](https://github.com/krahets/hello-algo/pull/1831#issuecomment-3675643973)

> <img width="523" height="590" alt="image" src="https://github.com/user-attachments/assets/c19f1267-4c69-4ae5-936d-be8f218d48a1" />
> 公式的字体，我下载了开源的mathjax字体换上了
> 
> [hello-algo_zh_python.epub.zip](https://github.com/user-attachments/files/24261559/hello-algo_zh_python.epub.zip)
> @krahets python 代码的样式处理了，除了换页，其它应该都OK了

### @krahets — 1 reactions  
`👍 1`  ·  [link](https://github.com/krahets/hello-algo/pull/1831#issuecomment-3697634216)

> [hello-algo_1.2.0_zh_python.epub.zip](https://github.com/user-attachments/files/24374960/hello-algo_1.2.0_zh_python.epub.zip)
> [hello-algo_1.2.0_zh-hant_java.epub.zip](https://github.com/user-attachments/files/24374976/hello-algo_1.2.0_zh-hant_java.epub.zip)
> 
> 我对 epub 格式进行了进一步优化，以上是最终文件。
> 
> 感谢提交 PR，非常棒的工作！我们将会在下个版本为读者提供 epub 版本


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
