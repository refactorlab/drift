# lobehub/lobehub #9043 — ✨ feat: add ComfyUI integration Phase1(RFC-128)

**[View PR on GitHub](https://github.com/lobehub/lobehub/pull/9043)**

| | |
|---|---|
| **Author** | @MapleEve |
| **Status** | ✅ merged |
| **Opened** | 2025-09-02 |
| **Repo importance** | ★78,228 · 15,371 forks · score 144,710 |
| **Diff** | +22066 / −32 across 130 files |
| **Engagement** | 25 conversation · 40 inline review comments |

## Top review comments (ranked by reactions)

### @tjx666 — 1 reactions  
`👍 1`  ·  [link](https://github.com/lobehub/lobehub/pull/9043#issuecomment-3245954962)

> @MapleEve 
> 
> Address and port number.
> 
> <img width="1098" height="654" alt="image" src="https://github.com/user-attachments/assets/9579498c-1859-400c-8dda-550ec634a804" />
> 
> <img width="1440" height="900" alt="image" src="https://github.com/user-attachments/assets/ee292a94-19a7-4f12-971c-e78c58e5e4ce" />
> 
> ---
> > This comment was translated by Claude.
> 
> <details>
> <summary>Original Content</summary>
> 
> @MapleEve 
> 
> 地址和端口号。
> 
> <img width="1098" height="654" alt="image" src="https://github.com/user-attachments/assets/9579498c-1859-400c-8dda-550ec634a804" />
> 
> <img width="1440" height="900" alt="image" src="https://github.com/user-attachments/assets/ee292a94-19a7-4f12-971c-e78c58e5e4ce" />
> 
> </details>

### @MapleEve — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/lobehub/lobehub/pull/9043#issuecomment-3414145323)

> > @MapleEve Let's aim to get this online this week. I'll do a comprehensive review and local testing over the weekend.
> 
> Conflicts and merge fix done. But haven't had time for local regression testing of the compatibility, but seems okay.

### @tjx666 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/9043#issuecomment-3245960793)

> @MapleEve 
> 
> The model doesn't exist, how do I know which model to download? Won't it download automatically?
> 
> <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/84e58c45-99ef-4132-b220-85ee85b5a99a" />
> 
> ---
> > This comment was translated by Claude.
> 
> <details>
> <summary>Original Content</summary>
> 
> @MapleEve 
> 
> 模型不存在,我咋知道下载哪个模型,不会自动下载吗?
> 
> <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/84e58c45-99ef-4132-b220-85ee85b5a99a" />
> 
> </details>

### @MapleEve — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/9043#issuecomment-3246228940)

> > @MapleEve 
> > 
> > 
> > 
> > 模型不存在,我咋知道下载哪个模型,不会自动下载吗?
> > 
> > 
> > 
> > <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/84e58c45-99ef-4132-b220-85ee85b5a99a" />
> > 
> > 
> 
> Comfy itself does not support automatic downloads. If you want external automatic downloads with an Ollama-like experience, you need to install the Comfy Manager node and wrap the SDK interface for the Manager plugin.
> 
> Additionally, on the Lobe side, you need to configure the corresponding model download links to control Comfy to download them.
> 
> The "model does not exist" prompt was originally intended to work like Ollama, but there are too many models involved, and some official models require registering an HuggingFace account and agreeing to their user terms on the model page before downloading. The prompt text can be adjusted.
> 
> ---
> > This comment was translated by Claude.
> 
> <details>
> <summary>Original Content</summary>
> 
> > @MapleEve 
> > 
> > 
> > 
> > 模型不存在,我咋知道下载哪个模型,不会自动下载吗?
> > 
> > 
> > 
> > <img width="1440" height="812" alt="image" src="https://github.com/user-attachments/assets/84e58c45-99ef-4132-b220-85ee85b5a99a" />
> > 
> > 
> 
> Comfy 本身不会,如果要外部自动下载且有类似 Ollama 的体验需要安装 Comfy Manager 这个 Node 并且封装 SDK 关于 Manager 插件的接口。
> 
> 另外 Lobe 这边还要配置对应模型的下载链接才可以控制 Comfy 去下载。
> 
> 这个模型不存在的提示本来是想做成 Ollama 那样的,但是涉及到的模型太多,且有些官模必须注册 hf 账号且去模型页面同意他的用户条例才给下载。可以调整提示文字内容。
> 
> </details>

### @tjx666 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/9043#issuecomment-3249829564)

> When I was chatting with you on WeChat in the evening, it reminded me of something I've always felt wasn't quite right.
> 
> - mode-runtime should be very lightweight and run cross-platform with no dependencies
> - You can read all other createImage implementations - they all use the approach of requesting an image generation API service, therefore:
>   - Need to move the logic of building workflows in model-runtime's comfyui createImage to an interface service
>   - You can implement your build workflow -> generate -> get generated images etc. in src/server/services/comfyui
>   - This service can be implemented in src/server/routers/lambda/comfy
> 
> ---
> > This comment was translated by Claude.
> 
> <details>
> <summary>Original Content</summary>
> 晚上和你微信聊的时候,反倒提醒了我一个一直觉得不太对劲的地方。
> 
> - mode-runtime 应该是很轻量,跨平台空运行的
> - 你可以阅读目前所有其它 createImage 实现,所有都是采用请求 生图 api 服务的方式生图,因此:
>   - 需要把 model-runtime 中 confyui 的 createImage 构建 workflow 的逻辑移到一个接口服务
>   - 可以在 src/server/services/comfyui 中实现你的 构建 workflow -> 生成 -> 获取生成图片 等
>   - 这个服务可以在 src/server/routers/lambda/comfy 中实现
> </details>

### @tjx666 — 0 reactions  
`—`  ·  [link](https://github.com/lobehub/lobehub/pull/9043#issuecomment-3249836245)

> 现在的设计是 createImage 跑在 remote server， 那对于本地用户，没有使用 ngrok 之类的情况下，就没办法拉取到 comfyui 生成的图片。ollama 是不是有同样的问题。 @arvinxx


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
