# ChatGPTNextWeb/NextChat #5174 — style: Fixed an issue where the sample of the reply content was displayed out of order

**[View PR on GitHub](https://github.com/ChatGPTNextWeb/NextChat/pull/5174)**

| | |
|---|---|
| **Author** | @ahzmr |
| **Status** | ✅ merged |
| **Opened** | 2024-08-02 |
| **Repo importance** | ★88,181 · 59,647 forks · score 331,475 |
| **Diff** | +23 / −9 across 3 files |
| **Engagement** | 42 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @ft4710403 — 0 reactions  
`—`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/5174#issuecomment-2295164556)

> 下载了，打包了镜像，启动起来以后，抛起来，代理那里如何设置呢，检查可用性还是。。。对了，webdav需要如何创建文件么~

### @ahzmr — 0 reactions  
`—`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/5174#issuecomment-2295166606)

> > 下载了，打包了镜像，启动起来以后，抛起来，代理那里如何设置呢，检查可用性还是。。。对了，webdav需要如何创建文件么~
> 
> 这个版本不需要创建文件。但如果不是白名单里的webdav服务，需要配置一下白名单环境变量就可以了。其他的就是配置好云同步配置，之后检查，再同步一次。如果打开了了自动同步，后面系统回复完消息，以及自己删除了会话时，会自动同步的。

### @ft4710403 — 0 reactions  
`—`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/5174#issuecomment-2295174188)

> > > 下载了，备份了镜像，启动起来以后，抛起来，代理那里怎么设置呢，检查可用性还是。。。对了，webdav 需要如何创建文件么~
> > 
> > 这个版本不需要文件。但是如果不是白名单里的webdav服务，需要配置一下白名单环境变量就可以了。其他的就是配置好云同步配置，之后检查，再同步一次。如果打开了自动同步，后面系统回复完成消息，以及自己删除了会话时，会自动同步的。
> 
> 果然可以了，那webdav的服务器和用户名信息可以用变量保存下来吗，免得每次换电脑又不行

### @ft4710403 — 0 reactions  
`—`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/5174#issuecomment-2295176649)

> ![微信截图_20240818162550](https://github.com/user-attachments/assets/53648692-03ba-4f83-af6a-499c275ba803)
> 每次发消息，和新建、删除会话，好像还是没有自动同步呢，目前测试还是要手动点

### @ahzmr — 0 reactions  
`—`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/5174#issuecomment-2295178431)

> > ![微信截图_20240818162550](https://private-user-images.githubusercontent.com/46487353/358893367-53648692-03ba-4f83-af6a-499c275ba803.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjM5NzAzODIsIm5iZiI6MTcyMzk3MDA4MiwicGF0aCI6Ii80NjQ4NzM1My8zNTg4OTMzNjctNTM2NDg2OTItMDNiYS00ZjgzLWFmNmEtNDk5YzI3NWJhODAzLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA4MTglMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwODE4VDA4MzQ0MlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTVhNTEyYzUxZDc5ZWJhYjViMjExZGQyYTkxOGFmNzI1ZGY0NTc3ZGQ4MDViZGJiY2M0MTkyYWZiYTJkYTViNDQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.PmQ8kwgPkFg1nc96JtZDr26pxjfi8ao3QvX031glZOM) 每次发消息，和新建、删除会话，好像还是没有自动同步呢，目前测试还是要手动点
> 
> 要确保打开自动同步，并且正常同步一次。这样就能自动同步了。

### @ft4710403 — 0 reactions  
`—`  ·  [link](https://github.com/ChatGPTNextWeb/NextChat/pull/5174#issuecomment-2295179890)

> 那应该是没开自动同步，找了半天没找到自动同步的开关，首次同步成功了，自动同步开关在哪呢~


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
